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
import { cn } from "@/lib/utils";
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
  "h-9 min-w-0 rounded-lg border border-pitch-700 bg-pitch-900 px-2 text-[13px] text-slate-200 outline-none focus:border-brand-500";

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
      <h1 className="mb-3 text-[22px] font-bold tracking-tight text-white">Players</h1>

      <nav aria-label="Position" className="mb-3 flex gap-1.5">
        {POSITIONS.map((p) => {
          const active = query.pos === p.key;
          return (
            <Link
              key={p.label}
              href={href(query, { pos: p.key, limit: PAGE_SIZE })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9 flex-1 items-center justify-center rounded-lg border text-[12.5px] font-bold transition",
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

      <form action="/players" className="mb-4 space-y-2">
        {query.pos && <input type="hidden" name="pos" value={POS_PARAM[query.pos]} />}
        <div className="flex gap-2">
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
        <div className="grid grid-cols-3 gap-2">
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

      <p className="mb-2 text-[12.5px] text-slate-500">
        {view.total === 0
          ? "No players match."
          : `${view.total} player${view.total === 1 ? "" : "s"}, by ${sort.label.toLowerCase()}. Tap one for the numbers.`}
        {!signedIn && " Sign in to star players for your watchlist."}
      </p>

      <div className="space-y-2">
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
