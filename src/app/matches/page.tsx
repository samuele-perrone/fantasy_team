import type { Metadata } from "next";
import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { MatchRow } from "@/components/match-ui";
import { getMatchday } from "@/lib/app/matches";
import { getSavedEntryId } from "@/lib/supabase/profile";
import { createClient, getUserId } from "@/lib/supabase/server";
import { listWatchlist } from "@/lib/supabase/watchlist";
import { cn } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

export const metadata: Metadata = { title: "Matches" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function GameweekLink({ gw, children }: { gw: number | null; children: React.ReactNode }) {
  const cls =
    "grid h-9 w-9 place-items-center rounded-lg border border-pitch-700 text-[16px] font-bold transition";
  return gw ? (
    <Link
      href={`/matches?gw=${gw}`}
      aria-label={`Gameweek ${gw}`}
      className={cn(cls, "text-slate-300 hover:border-brand-500 hover:text-white")}
    >
      {children}
    </Link>
  ) : (
    <span aria-hidden className={cn(cls, "text-slate-700")}>
      {children}
    </span>
  );
}

export default async function MatchesPage({ searchParams }: PageProps<"/matches">) {
  const params = await searchParams;
  const gw = Number(first(params.gw));
  const signedIn = Boolean(await getUserId());
  const [entryId, watchIds] = signedIn
    ? await Promise.all([
        getSavedEntryId(),
        createClient().then((s) => listWatchlist(s as unknown as SupabaseClient)),
      ])
    : [null, []];

  let view;
  try {
    view = await getMatchday(Number.isInteger(gw) && gw > 0 ? gw : null, { entryId, watchIds });
  } catch {
    return (
      <div>
        <h1 className="mb-3 text-[22px] font-bold tracking-tight text-white">Matches</h1>
        <p className="panel px-4 py-3 text-[13.5px] text-amber-300">
          Could not load matches right now. FPL may be updating, so try again shortly.
        </p>
      </div>
    );
  }

  return (
    <div>
      {view.live && <LiveRefresh />}
      <div className="mb-4 flex items-center justify-between gap-3">
        <GameweekLink gw={view.prev}>‹</GameweekLink>
        <div className="text-center">
          <h1 className="text-[22px] font-bold tracking-tight text-white">
            Gameweek {view.event}
          </h1>
          {view.live && (
            <p className="text-[12px] font-semibold text-rose-300">Live · updates every minute</p>
          )}
        </div>
        <GameweekLink gw={view.next}>›</GameweekLink>
      </div>

      {!view.hasSquad && (
        <p className="mb-4 text-[12.5px] text-slate-400">
          <Link href="/squad" className="font-semibold text-brand-400 hover:underline">
            Load your squad
          </Link>{" "}
          to see your players highlighted in each match.
        </p>
      )}

      {view.days.length === 0 ? (
        <p className="panel px-4 py-3 text-[13px] text-slate-400">No matches in this gameweek.</p>
      ) : (
        <div className="space-y-5">
          {view.days.map((d) => (
            <section key={d.day}>
              <h2 className="mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">
                {d.day}
              </h2>
              <div className="space-y-2">
                {d.matches.map((m) => (
                  <MatchRow key={m.id} m={m} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-5 text-[11.5px] leading-relaxed text-slate-500">
        Scores and points come from FPL and can run a minute or two behind the match. Bonus is
        shown as it would be if the match ended now, until FPL confirms it after full time.
      </p>
    </div>
  );
}
