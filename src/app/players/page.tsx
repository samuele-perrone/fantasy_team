import type { Metadata } from "next";
import Link from "next/link";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { ExpandableRow, PlayerLine, PlayerNumbers, WatchButton } from "@/components/squad-ui";
import {
  browsePlayers,
  PAGE_SIZE,
  parseBrowseQuery,
  SORTS,
  type BrowseQuery,
  type SortKey,
} from "@/lib/app/players";
import { createClient, getUserId } from "@/lib/supabase/server";
import { listWatchlist } from "@/lib/supabase/watchlist";
import { FixtureRun, PlayerFlag, PlayerPhoto } from "@/components/ui";
import type { PlayerRow } from "@/lib/fpl/row";
import { cn, money } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

export const metadata: Metadata = { title: "Players" };

const POSITIONS = [
  { key: null, label: "All" },
  { key: 1, label: "GKP" },
  { key: 2, label: "DEF" },
  { key: 3, label: "MID" },
  { key: 4, label: "FWD" },
] as const;
const POS_PARAM: Record<number, string> = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };
const PRICES = [4.5, 5, 5.5, 6, 6.5, 7, 8, 9, 10, 12];

/** This page's URL with some filters changed, leaving defaults out so links stay short. */
function href(q: BrowseQuery, over: Partial<BrowseQuery>) {
  const next = { ...q, ...over };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.pos) params.set("pos", POS_PARAM[next.pos]);
  if (next.team) params.set("team", String(next.team));
  if (next.maxPrice) params.set("max", String(next.maxPrice));
  if (next.sort !== "points5") params.set("sort", next.sort);
  if (next.limit !== PAGE_SIZE) params.set("n", String(next.limit));
  const s = params.toString();
  return s ? `/players?${s}` : "/players";
}

const selectClass =
  "h-9 min-w-0 rounded-lg border border-pitch-700 bg-pitch-900 px-2 text-[13px] text-slate-200 outline-none focus:border-brand-500 xl:h-10 xl:w-40";

/** The columns of the wide-screen table, each one a sort. */
const COLUMNS: { sort: SortKey; label: string; cell: (p: PlayerRow) => string }[] = [
  { sort: "price", label: "Price", cell: (p) => money(p.cost) },
  { sort: "points5", label: "Next 5", cell: (p) => p.xPts.toFixed(1) },
  { sort: "next", label: "Next game", cell: (p) => p.xPtsNext.toFixed(1) },
  { sort: "form", label: "Form", cell: (p) => p.form.toFixed(1) },
  { sort: "season", label: "Season", cell: (p) => String(p.totalPoints) },
  { sort: "picked", label: "Picked", cell: (p) => `${p.selectedBy.toFixed(1)}%` },
];

/**
 * The wide-screen view: a table, sortable from its headers, where a phone gets expandable
 * cards. A name opens the player's page, which holds what the cards' (i) panel shows.
 */
function PlayersTable({
  players,
  query,
  signedIn,
  watched,
}: {
  players: PlayerRow[];
  query: BrowseQuery;
  signedIn: boolean;
  watched: Set<number>;
}) {
  if (!players.length) return null;
  return (
    <div className="panel hidden overflow-x-auto lg:block">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="border-b border-pitch-700 text-[11px] uppercase tracking-wide text-slate-500">
            {signedIn && <th className="w-12" aria-label="Watch" />}
            <th className="py-3 pl-4 text-left font-semibold">Player</th>
            {COLUMNS.map((c) => (
              <th key={c.sort} className="px-3 text-right font-semibold">
                <Link
                  href={href(query, { sort: c.sort, limit: PAGE_SIZE })}
                  aria-current={query.sort === c.sort ? "true" : undefined}
                  className={cn(
                    "transition hover:text-white",
                    query.sort === c.sort && "text-brand-300",
                  )}
                >
                  {c.label}
                  {query.sort === c.sort && " ↓"}
                </Link>
              </th>
            ))}
            <th className="px-4 text-left font-semibold">Next games</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className="border-b border-pitch-800 last:border-0 hover:bg-pitch-800/40">
              {signedIn && (
                <td className="pl-2">
                  <WatchButton playerId={p.id} watched={watched.has(p.id)} />
                </td>
              )}
              <td className="py-2 pl-4">
                <Link href={`/players/${p.id}`} className="flex items-center gap-3 hover:underline">
                  <PlayerPhoto code={p.code} size={36} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-bold text-white">
                      {p.name}
                      <PlayerFlag status={p.status} news={p.news} availability={p.availability} />
                    </span>
                    <span className="block text-[12px] text-slate-500">
                      {p.teamName} · {p.pos}
                    </span>
                  </span>
                </Link>
              </td>
              {COLUMNS.map((c) => (
                <td
                  key={c.sort}
                  className={cn(
                    "num px-3 text-right",
                    query.sort === c.sort ? "font-bold text-white" : "text-slate-300",
                  )}
                >
                  {c.cell(p)}
                </td>
              ))}
              <td className="px-4">
                <FixtureRun fixtures={p.fixtures} max={4} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function PlayersPage({ searchParams }: PageProps<"/players">) {
  const query = parseBrowseQuery(await searchParams);
  const signedIn = Boolean(await getUserId());
  const [view, watchedIds] = await Promise.all([
    browsePlayers(query),
    signedIn
      ? createClient().then((s) => listWatchlist(s as unknown as SupabaseClient))
      : Promise.resolve([] as number[]),
  ]);
  const watched = new Set(watchedIds);
  const sort = SORTS[query.sort];

  return (
    <div>
      <h1 className="mb-3 text-[22px] font-bold tracking-tight md:text-[28px] text-white">Players</h1>

      {/* One row of filters on a wide screen; stacked on a phone. */}
      <div className="mb-4 space-y-2 xl:flex xl:items-center xl:gap-3 xl:space-y-0">
        <nav aria-label="Position" className="flex gap-1.5 xl:flex-none">
          {POSITIONS.map((p) => {
            const active = query.pos === p.key;
            return (
              <Link
                key={p.label}
                href={href(query, { pos: p.key, limit: PAGE_SIZE })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 flex-1 items-center justify-center rounded-lg border text-[12.5px] font-bold transition xl:w-14 xl:flex-none",
                  active
                    ? "border-brand-500 bg-brand-500/15 text-brand-300"
                    : "border-pitch-700 text-slate-400 hover:text-white",
                )}
              >
                {p.label}
              </Link>
            );
          })}
        </nav>

        <form
          action="/players"
          className="space-y-2 xl:flex xl:flex-1 xl:items-center xl:gap-2 xl:space-y-0"
        >
          {query.pos && <input type="hidden" name="pos" value={POS_PARAM[query.pos]} />}
          <div className="flex gap-2 xl:flex-1">
            <input
              name="q"
              defaultValue={query.q}
              placeholder="Search by name"
              aria-label="Search by name"
              className="h-10 min-w-0 flex-1 rounded-lg border border-pitch-700 bg-pitch-900 px-3 text-[14px] outline-none placeholder:text-slate-600 focus:border-brand-500"
            />
            <button
              type="submit"
              className="h-10 rounded-lg bg-brand-500 px-4 text-[13.5px] font-bold text-ink transition hover:bg-brand-600"
            >
              Search
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 xl:flex">
            <AutoSubmitSelect
              name="team"
              defaultValue={query.team ?? ""}
              aria-label="Club"
              className={selectClass}
            >
              <option value="">All clubs</option>
              {view.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </AutoSubmitSelect>
            <AutoSubmitSelect
              name="max"
              defaultValue={query.maxPrice ?? ""}
              aria-label="Maximum price"
              className={selectClass}
            >
              <option value="">Any price</option>
              {PRICES.map((p) => (
                <option key={p} value={p}>
                  Up to £{p.toFixed(1)}m
                </option>
              ))}
            </AutoSubmitSelect>
            <AutoSubmitSelect
              name="sort"
              defaultValue={query.sort}
              aria-label="Sort by"
              className={selectClass}
            >
              {(Object.keys(SORTS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORTS[k].label}
                </option>
              ))}
            </AutoSubmitSelect>
          </div>
        </form>
      </div>

      <p className="mb-2 text-[12.5px] text-slate-500">
        {view.total === 0
          ? "No players match."
          : `${view.total} player${view.total === 1 ? "" : "s"}, by ${sort.label.toLowerCase()}.`}
        {view.total > 0 && (
          <span className="lg:hidden"> Tap one for the numbers.</span>
        )}
        {!signedIn && " Sign in to star players for your watchlist."}
      </p>

      <PlayersTable
        players={view.players}
        query={query}
        signedIn={signedIn}
        watched={watched}
      />

      <div className="space-y-2 lg:hidden">
        {view.players.map((p) => (
          <ExpandableRow
            key={p.id}
            leading={
              signedIn ? <WatchButton playerId={p.id} watched={watched.has(p.id)} /> : undefined
            }
            photo={p}
            title={<PlayerLine p={p} />}
            reason={
              <>
                {sort.show(p)}
                {query.sort !== "points5" && (
                  <span className="text-slate-500"> · {SORTS.points5.show(p)}</span>
                )}
              </>
            }
          >
            <PlayerNumbers p={p} />
          </ExpandableRow>
        ))}
      </div>

      {view.players.length < view.total && (
        <Link
          href={href(query, { limit: query.limit + PAGE_SIZE })}
          scroll={false}
          className="mt-3 flex h-11 items-center justify-center rounded-xl border border-pitch-700 text-[13.5px] font-semibold text-slate-300 transition hover:border-brand-500 hover:text-white"
        >
          Show {Math.min(PAGE_SIZE, view.total - view.players.length)} more
        </Link>
      )}
    </div>
  );
}
