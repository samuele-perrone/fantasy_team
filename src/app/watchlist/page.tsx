import type { Metadata } from "next";
import Link from "next/link";
import { ExpandableRow, PlayerLine, PlayerNumbers, WatchButton } from "@/components/squad-ui";
import { PlayerPhoto } from "@/components/ui";
import { getSquadView, getWatchedPlayers, searchPlayers } from "@/lib/app/squad";
import { getSavedEntryId } from "@/lib/supabase/profile";
import { createClient, getUserId } from "@/lib/supabase/server";
import { listWatchlist } from "@/lib/supabase/watchlist";
import type { SupabaseClient } from "@supabase/supabase-js";

export const metadata: Metadata = { title: "Watchlist" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function SectionTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-2 mt-6 first:mt-0">
      <h2 className="text-[15px] font-bold text-white">{children}</h2>
      {note && <p className="text-[12px] text-slate-500">{note}</p>}
    </div>
  );
}

export default async function WatchlistPage({ searchParams }: PageProps<"/watchlist">) {
  const params = await searchParams;
  const query = first(params.q)?.trim() ?? "";
  const signedIn = Boolean(await getUserId());
  const entryId = signedIn ? await getSavedEntryId() : null;
  const ids = signedIn
    ? await listWatchlist((await createClient()) as unknown as SupabaseClient)
    : [];
  const watched = new Set(ids);

  const [view, players, results] = await Promise.all([
    entryId ? getSquadView(entryId).catch(() => null) : Promise.resolve(null),
    getWatchedPlayers(ids, entryId),
    searchPlayers(query),
  ]);

  return (
    <div>
      <h1 className="mb-4 text-[22px] font-bold tracking-tight text-white">Watchlist</h1>

      <SectionTitle note="The best buys you can afford, whether or not anyone is marked Sell.">
        Suggested this week
      </SectionTitle>
      {!entryId ? (
        <p className="panel px-4 py-3 text-[13px] text-slate-400">
          <Link href="/squad" className="font-semibold text-brand-400 hover:underline">
            Load your squad
          </Link>{" "}
          to see who is worth buying for it.
        </p>
      ) : !view ? (
        <p className="panel px-4 py-3 text-[13px] text-amber-300">
          Could not load your squad right now. Try again shortly.
        </p>
      ) : view.suggestions.length === 0 ? (
        <p className="panel px-4 py-3 text-[13px] text-slate-400">
          Nobody you can afford is clearly better than what you have.
        </p>
      ) : (
        <div className="space-y-2">
          {view.suggestions.map((s) => (
            <ExpandableRow
              key={s.player.id}
              leading={<WatchButton playerId={s.player.id} watched={watched.has(s.player.id)} />}
              photo={s.player}
              title={<PlayerLine p={s.player} />}
              reason={
                <>
                  {s.reason}
                  <span className="block text-slate-500">
                    For {s.replaces.name}, about {Math.round(s.gain)} more points over five
                    gameweeks
                  </span>
                </>
              }
            >
              <PlayerNumbers p={s.player} />
            </ExpandableRow>
          ))}
        </div>
      )}

      <SectionTitle>Watching</SectionTitle>
      {!signedIn ? (
        <p className="panel px-4 py-3 text-[13px] text-slate-400">Sign in to keep a watchlist.</p>
      ) : players.length === 0 ? (
        <p className="panel px-4 py-3 text-[13px] text-slate-400">
          Nobody yet. Tap ☆ on a suggestion, a replacement, or a search result below.
        </p>
      ) : (
        <div className="space-y-2">
          {players.map(({ player, swap }) => (
            <ExpandableRow
              key={player.id}
              leading={<WatchButton playerId={player.id} watched />}
              photo={player}
              title={<PlayerLine p={player} />}
              reason={
                !swap
                  ? entryId
                    ? "Not affordable for anyone in your squad, or already yours"
                    : "Load your squad to compare"
                  : swap.gain >= 2
                    ? `Would replace ${swap.replaces.name}, about ${Math.round(swap.gain)} more points over five gameweeks`
                    : swap.gain > 0
                      ? `Only slightly better than ${swap.replaces.name} for now`
                      : `Not better than ${swap.replaces.name} yet`
              }
            >
              <PlayerNumbers p={player} />
            </ExpandableRow>
          ))}
        </div>
      )}

      <SectionTitle>Add a player</SectionTitle>
      <form action="/watchlist" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by name"
          className="h-10 min-w-0 flex-1 rounded-lg border border-pitch-700 bg-pitch-900 px-3 text-[14px] outline-none placeholder:text-slate-600 focus:border-brand-500"
        />
        <button
          type="submit"
          className="h-10 rounded-lg bg-brand-500 px-4 text-[13.5px] font-bold text-ink transition hover:bg-brand-600"
        >
          Search
        </button>
      </form>
      {query.length >= 2 && (
        <ul className="panel mt-2 divide-y divide-pitch-800">
          {results.length === 0 && (
            <li className="px-4 py-3 text-[13px] text-slate-400">No player matches “{query}”.</li>
          )}
          {results.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 py-1.5 pl-3 pr-1">
              <PlayerPhoto code={p.code} name={p.name} size={32} />
              <Link href={`/players/${p.id}`} className="min-w-0 flex-1 hover:underline">
                <PlayerLine p={p} />
              </Link>
              {signedIn && <WatchButton playerId={p.id} watched={watched.has(p.id)} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
