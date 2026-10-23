import type { Metadata } from "next";
import Link from "next/link";
import { EntryForm } from "@/components/entry-form";
import { CaptainCard, VerdictRow } from "@/components/squad-ui";
import { getSquadView } from "@/lib/app/squad";
import { EntryNotFound } from "@/lib/fpl/entry";
import { TeamSwitcher } from "@/components/team-switcher";
import { listTeams, type TeamsView } from "@/lib/supabase/teams";
import { createClient, getUserId } from "@/lib/supabase/server";
import { listWatchlist } from "@/lib/supabase/watchlist";
import { money } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

export const metadata: Metadata = { title: "My Squad" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SquadPage({ searchParams }: PageProps<"/squad">) {
  const params = await searchParams;
  const userId = await getUserId();
  const signedIn = Boolean(userId);
  const rawId = first(params.id);
  // ?enter=1 is "I want to add a team", so the saved one must not load over the form.
  const wantsForm = Boolean(first(params.enter));
  const saved: TeamsView = userId
    ? await listTeams((await createClient()) as unknown as SupabaseClient, userId)
    : { active: null, teams: [] };
  const entryId = rawId && /^\d+$/.test(rawId) ? Number(rawId) : wantsForm ? null : saved.active;

  if (!entryId || wantsForm) {
    return (
      <div className="max-w-md">
        <h1 className="mb-1 text-[22px] font-bold tracking-tight md:text-[28px] text-white">My Squad</h1>
        <p className="mb-4 text-[13px] leading-snug text-slate-400">
          Enter your FPL team ID once. Every player gets a verdict, keep, watch or sell, with the
          reason in one line.
        </p>
        <EntryForm action="/squad" signedIn={signedIn} defaultValue={rawId} />
        {first(params.error) && (
          <p className="mt-3 text-[13px] text-rose-400">
            {first(params.error) === "notfound"
              ? `No FPL team found for ID ${first(params.id) ?? ""}. Check the number and try again.`
              : "That does not look like a team ID. It should be digits only."}
          </p>
        )}
        {saved.teams.length > 0 && (
          <Link
            href="/squad"
            className="mt-3 inline-block text-[13px] font-semibold text-slate-400 hover:text-white hover:underline"
          >
            ← Back to my teams
          </Link>
        )}
      </div>
    );
  }

  let view;
  try {
    view = await getSquadView(entryId);
  } catch (e) {
    return (
      <div className="max-w-xl">
        <h1 className="mb-3 text-[22px] font-bold tracking-tight md:text-[28px] text-white">My Squad</h1>
        <div className="panel px-4 py-3 text-[13.5px] text-amber-300">
          {e instanceof EntryNotFound
            ? e.message
            : "Could not load your squad right now. FPL may be updating, so try again shortly."}
        </div>
        <Link
          href="/squad?enter=1"
          className="mt-3 inline-block text-[13px] font-semibold text-brand-400 hover:underline"
        >
          Use a different team ID
        </Link>
      </div>
    );
  }

  const watched = new Set(
    signedIn ? await listWatchlist((await createClient()) as unknown as SupabaseClient) : [],
  );
  const { team, verdicts } = view;
  const counts = {
    sell: verdicts.filter((v) => v.verdict === "sell").length,
    watch: verdicts.filter((v) => v.verdict === "watch").length,
  };

  return (
    <div>
      <div className="mb-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-400">
          Gameweek {team.nextEvent}
        </div>
        {signedIn && saved.teams.length > 0 ? (
          <TeamSwitcher name={team.name} current={team.entryId} teams={saved.teams} />
        ) : (
          <h1 className="truncate text-[22px] font-bold tracking-tight md:text-[28px] text-white">{team.name}</h1>
        )}
        <p className="mt-0.5 text-[12.5px] text-slate-400">
          {money(team.bank)} in the bank · {team.freeTransfers} free transfer
          {team.freeTransfers === 1 ? "" : "s"}
          {!(signedIn && saved.teams.length > 0) && (
            <>
              {" · "}
              <Link href="/squad?enter=1" className="text-slate-500 hover:text-white hover:underline">
                change team
              </Link>
            </>
          )}
        </p>
      </div>

      <p className="mb-3 text-[13px] text-slate-300">
        {counts.sell
          ? `${counts.sell} to sell, ${counts.watch} to watch.`
          : counts.watch
            ? `Nothing to sell. ${counts.watch} to watch.`
            : "Nothing to change this week."}{" "}
        <span className="text-slate-500">Tap a player for the numbers.</span>
      </p>

      {view.captain && <CaptainCard pick={view.captain} verdicts={verdicts} />}

      {/* Two columns on a wide screen. items-start, so opening one row does not stretch the
          row beside it. */}
      <div className="grid items-start gap-2 lg:grid-cols-2 lg:gap-3">
        {verdicts.map((v) => (
          <VerdictRow key={v.player.id} v={v} watched={watched} />
        ))}
      </div>

      <p className="mt-5 max-w-3xl text-[11.5px] leading-relaxed text-slate-500">
        Verdicts compare each player with the best replacement you can afford over the next five
        gameweeks. Our points estimates are typically off by about 1.6 points per player per
        week, so a player is only marked Sell when the gap is clearly bigger than that. FPL does
        not show transfers you have made since the last deadline, so this is your squad as it
        stood then.
      </p>
    </div>
  );
}
