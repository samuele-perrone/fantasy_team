import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FindYourId } from "@/components/entry-form";
import { PageHeader, StatCard } from "@/components/ui";
import { getEntry, getLeagueStandings } from "@/lib/fpl/client";
import type { LeagueStandings } from "@/lib/fpl/types";
import { cn } from "@/lib/utils";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Mini-Leagues & Awards",
  description:
    "Mini-league standings, gameweek movement and season awards for any classic Fantasy Premier League league.",
};

export default async function LeaguesPage({ searchParams }: PageProps<"/leagues">) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const leagueId = Number(one(params.league));
  const entryId = Number(one(params.id));
  const page = Math.max(1, Number(one(params.page)) || 1);

  async function submit(formData: FormData) {
    "use server";
    const league = String(formData.get("league") ?? "").trim();
    const entry = String(formData.get("entry") ?? "").trim();
    if (/^\d+$/.test(league)) redirect(`/leagues?league=${league}`);
    if (/^\d+$/.test(entry)) redirect(`/leagues?id=${entry}`);
    redirect("/leagues");
  }

  const form = (
    <form action={submit} className="panel flex flex-wrap items-end gap-4 px-4 py-3.5">
      <div>
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
          League ID
        </label>
        <input
          name="league"
          inputMode="numeric"
          defaultValue={Number.isFinite(leagueId) ? String(leagueId) : ""}
          placeholder="e.g. 314"
          className="h-10 w-44 rounded-lg border border-pitch-700 bg-pitch-900 px-3 text-[14px] outline-none placeholder:text-slate-600 focus:border-brand-500"
        />
      </div>
      <span className="pb-2.5 text-[12px] text-slate-600">or</span>
      <div>
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Your team ID — list my leagues
        </label>
        <input
          name="entry"
          inputMode="numeric"
          defaultValue={Number.isFinite(entryId) ? String(entryId) : ""}
          placeholder="e.g. 1234567"
          className="h-10 w-44 rounded-lg border border-pitch-700 bg-pitch-900 px-3 text-[14px] outline-none placeholder:text-slate-600 focus:border-brand-500"
        />
      </div>
      <button
        type="submit"
        className="h-10 rounded-lg bg-brand-500 px-5 text-[13.5px] font-bold text-pitch-950 transition hover:bg-brand-400"
      >
        Load
      </button>
      <FindYourId className="w-full border-t border-pitch-800 pt-3" />
    </form>
  );

  // Entry mode: show all of a manager's leagues so they can pick one.
  if (!Number.isFinite(leagueId) && Number.isFinite(entryId)) {
    const entry = await getEntry(entryId).catch(() => null);

    if (!entry) {
      return (
        <div>
          <PageHeader eyebrow="My Team" title="Mini-Leagues & Awards" />
          {form}
          <div className="panel mt-4 px-5 py-4 text-[13.5px] text-amber-300">
            No squad found for ID {entryId}.
          </div>
        </div>
      );
    }

    return (
      <div>
        <PageHeader
          eyebrow="My Team"
          title={`${entry.name} — leagues`}
          description={`${entry.player_first_name} ${entry.player_last_name}'s classic and head-to-head leagues.`}
        />
        {form}
        <div className="panel mt-4 divide-y divide-pitch-800">
          {entry.leagues.classic.map((l) => (
            <Link
              key={l.id}
              href={`/leagues?league=${l.id}`}
              className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-pitch-800/50"
            >
              <span className="text-[13.5px] font-semibold text-white">{l.name}</span>
              <span className="num ml-auto text-[12.5px] text-slate-400">
                {l.entry_rank ? `Rank ${l.entry_rank.toLocaleString("en-GB")}` : "Unranked"}
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (!Number.isFinite(leagueId)) {
    return (
      <div>
        <PageHeader
          eyebrow="My Team"
          title="Mini-Leagues & Awards"
          description="Load any classic league by its ID to see the full table, gameweek movement and the season awards — best and worst gameweek, and who is climbing fastest. Find a league ID in its FPL URL, or enter your team ID to list every league you are in."
        />
        {form}
        <div className="panel mt-4 px-5 py-4 text-[13px] text-slate-400">
          Try league <strong className="text-white">314</strong> — the Overall league containing
          every FPL manager.
        </div>
      </div>
    );
  }

  const standings: LeagueStandings | null = await getLeagueStandings(leagueId, page).catch(
    () => null,
  );

  if (!standings) {
    return (
      <div>
        <PageHeader eyebrow="My Team" title="Mini-Leagues & Awards" />
        {form}
        <div className="panel mt-4 px-5 py-4 text-[13.5px] text-amber-300">
          Could not find a classic league with ID {leagueId}. Head-to-head leagues are not
          supported.
        </div>
      </div>
    );
  }

  const results = standings.standings.results;
  const topGw = [...results].sort((a, b) => b.event_total - a.event_total)[0];
  const worstGw = [...results].sort((a, b) => a.event_total - b.event_total)[0];
  const biggestClimb = [...results]
    .filter((r) => r.last_rank > 0)
    .sort((a, b) => b.last_rank - b.rank - (a.last_rank - a.rank))[0];
  const averageTotal = results.length
    ? Math.round(results.reduce((a, r) => a + r.total, 0) / results.length)
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="My Team" title={standings.league.name} description="Classic league standings" />
      {form}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Gameweek winner"
          value={topGw?.event_total ?? "—"}
          sub={topGw?.entry_name}
          tone="brand"
        />
        <StatCard label="Lowest this week" value={worstGw?.event_total ?? "—"} sub={worstGw?.entry_name} tone="warn" />
        <StatCard
          label="Biggest climb"
          value={
            biggestClimb ? `${biggestClimb.last_rank - biggestClimb.rank >= 0 ? "+" : ""}${biggestClimb.last_rank - biggestClimb.rank}` : "—"
          }
          sub={biggestClimb?.entry_name}
        />
        <StatCard label="League average" value={averageTotal} sub={`${results.length} shown on this page`} />
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[620px] text-[13px]">
          <thead>
            <tr className="border-b border-pitch-700 text-[10.5px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2 text-left">Rank</th>
              <th className="text-left">Team</th>
              <th className="text-left">Manager</th>
              <th className="text-right">GW</th>
              <th className="px-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const move = r.last_rank > 0 ? r.last_rank - r.rank : 0;
              return (
                <tr key={r.id} className="border-b border-pitch-800/60 hover:bg-pitch-800/40">
                  <td className="px-4 py-1.5">
                    <span className="flex items-center gap-1.5">
                      <span className="num font-bold text-white">{r.rank}</span>
                      {move !== 0 && (
                        <span
                          className={cn(
                            "num text-[10.5px]",
                            move > 0 ? "text-brand-400" : "text-rose-400",
                          )}
                        >
                          {move > 0 ? "▲" : "▼"}
                          {Math.abs(move)}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-1.5">
                    <Link
                      href={`/my-team?id=${r.entry}`}
                      className="font-semibold text-white hover:text-brand-400 hover:underline"
                    >
                      {r.entry_name}
                    </Link>
                  </td>
                  <td className="py-1.5 text-slate-400">{r.player_name}</td>
                  <td className="num pr-1 text-right text-slate-300">{r.event_total}</td>
                  <td className="num px-4 py-1.5 text-right font-bold text-white">{r.total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        {page > 1 ? (
          <Link
            href={`/leagues?league=${leagueId}&page=${page - 1}`}
            className="rounded-lg border border-pitch-700 px-4 py-2 text-[13px] font-semibold text-slate-300 hover:border-brand-500 hover:text-white"
          >
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        {standings.standings.has_next && (
          <Link
            href={`/leagues?league=${leagueId}&page=${page + 1}`}
            className="rounded-lg border border-pitch-700 px-4 py-2 text-[13px] font-semibold text-slate-300 hover:border-brand-500 hover:text-white"
          >
            Next page →
          </Link>
        )}
      </div>
    </div>
  );
}
