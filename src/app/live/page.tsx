import type { Metadata } from "next";
import Link from "next/link";
import { EntryForm } from "@/components/entry-form";
import { PageHeader, PlayerLink, PositionBadge, StatCard } from "@/components/ui";
import { getLive } from "@/lib/fpl/client";
import { getGameData } from "@/lib/fpl/data";
import { EntryNotFound, InvalidSquad, resolveTeam, teamQueryString } from "@/lib/fpl/entry";
import type { LiveElement } from "@/lib/fpl/types";
import { cn } from "@/lib/utils";
import { benchCounts, chipLabel, chipNote } from "@/lib/fpl/chips";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Live Rank",
  description:
    "Live Fantasy Premier League points for your squad, including provisional bonus, auto-substitutions and captain multipliers, updated as matches play out.",
};

export default async function LivePage({ searchParams }: PageProps<"/live">) {
  const params = await searchParams;
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const query = teamQueryString(params);
  const data = await getGameData();

  let team;
  try {
    team = await resolveTeam(params, 5);
  } catch (e) {
    return (
      <div>
        <PageHeader eyebrow="My Team" title="Live Rank" />
        <EntryForm action="/live" defaultValue={idParam} />
        <div className="panel mt-4 px-5 py-4 text-[13.5px] text-amber-300">
          {e instanceof EntryNotFound || e instanceof InvalidSquad
            ? e.message
            : "Could not load that squad right now."}
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div>
        <PageHeader
          eyebrow="My Team"
          title="Live Rank"
          description="Follow your gameweek as it happens: live points per player, provisional bonus baked in, captain multipliers applied and a running total against the gameweek average."
        />
        <EntryForm action="/live" />
        <div className="panel mt-4 px-5 py-4 text-[13.5px] text-slate-300">
          No team ID, or FPL not showing your picks yet?{" "}
          <Link href="/squad" className="font-semibold text-brand-400 hover:underline">
            Build your squad manually or import it from a screenshot →
          </Link>
        </div>
      </div>
    );
  }

  let live: LiveElement[] = [];
  try {
    live = (await getLive(team.event)).elements;
  } catch {
    live = [];
  }
  const liveById = new Map(live.map((e) => [e.id, e]));
  const event = data.events.find((e) => e.id === team.event);

  const picks = team.picks.map((pick) => {
    const row = team.squad.find((p) => p.id === pick.element);
    const stats = liveById.get(pick.element)?.stats;
    return {
      pick,
      row,
      stats,
      points: (stats?.total_points ?? 0) * pick.multiplier,
      raw: stats?.total_points ?? 0,
    };
  });

  const starters = picks.filter((p) => p.pick.position <= 11);
  const bench = picks.filter((p) => p.pick.position > 11);

  // Multiply rather than filter by position: FPL encodes chips in the multiplier, giving
  // bench players 1 under Bench Boost and the captain 3 under Triple Captain. Summing only
  // positions 1-11 silently dropped every bench point of a Bench Boost gameweek.
  const livePoints = picks.reduce((a, p) => a + p.points, 0);
  const benchPoints = bench.reduce((a, p) => a + p.raw, 0);
  const chip = team.activeChip;
  const benchIsScoring = benchCounts(chip);
  const played = starters.filter((p) => (p.stats?.minutes ?? 0) > 0).length;
  const toPlay = starters.length - played;
  const average = event?.average_entry_score ?? 0;
  const hits = team.eventTransfersCost;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My Team"
        title={`${team.name} — live`}
        badge={chipLabel(chip)}
        description={
          chipNote(chip)
            ? `Gameweek ${team.event} · ${chipLabel(chip)} active — ${chipNote(chip)} Bonus is provisional until each match is marked finished.`
            : `Gameweek ${team.event}. Bonus shown here is provisional until each match is marked finished.`
        }
      >
        <Link
          href={`/my-team?${query}`}
          className="rounded-lg border border-pitch-600 px-4 py-2 text-[13px] font-bold text-slate-300 transition hover:border-brand-500 hover:text-white"
        >
          ← Squad
        </Link>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Live points"
          value={livePoints - hits}
          sub={hits ? `${livePoints} before a −${hits} hit` : "Including captain"}
          tone="brand"
        />
        <StatCard
          label="GW average"
          value={average || "—"}
          sub={average ? `${livePoints - hits - average >= 0 ? "+" : ""}${livePoints - hits - average} vs average` : "Not yet published"}
        />
        <StatCard label="Players to play" value={toPlay} sub={`${played} of ${starters.length} started`} />
        <StatCard
          label={benchIsScoring ? "Bench (counting)" : "Points on bench"}
          value={benchPoints}
          sub={benchIsScoring ? "Included in your total" : "Before auto-subs"}
          tone={benchIsScoring ? "brand" : "default"}
        />
        <StatCard
          label="Overall rank"
          value={team.overallRank ? team.overallRank.toLocaleString("en-GB") : "—"}
          sub="Last confirmed"
        />
      </div>

      {!live.length && (
        <div className="panel px-5 py-4 text-[13px] text-slate-400">
          Live data for gameweek {team.event} is not available yet. It appears once the first match
          of the gameweek kicks off.
        </div>
      )}

      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead>
            <tr className="border-b border-pitch-700 text-[10.5px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2 text-left">Player</th>
              <th className="text-right">Mins</th>
              <th className="text-right">G</th>
              <th className="text-right">A</th>
              <th className="text-right">CS</th>
              <th className="text-right">DC</th>
              <th className="text-right">BPS</th>
              <th className="text-right">Bonus</th>
              <th className="text-right">Pts</th>
              <th className="px-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {[...starters, ...bench].map(({ pick, row, stats, points, raw }, i) => (
              <tr
                key={pick.element}
                className={cn(
                  "border-b border-pitch-800/60 hover:bg-pitch-800/40",
                  i === starters.length && "border-t-2 border-t-pitch-600",
                )}
              >
                <td className="px-4 py-1.5">
                  <div className="flex items-center gap-2">
                    {row && <PositionBadge pos={row.pos} />}
                    <PlayerLink id={pick.element} name={row?.name ?? String(pick.element)} />
                    <span className="text-[11px] text-slate-500">{row?.team}</span>
                    {pick.is_captain && (
                      <span className="rounded-full bg-white px-1.5 text-[9.5px] font-black text-pitch-950">
                        C
                      </span>
                    )}
                    {pick.is_vice_captain && (
                      <span className="rounded-full bg-slate-400 px-1.5 text-[9.5px] font-black text-pitch-950">
                        V
                      </span>
                    )}
                    {pick.position > 11 && (
                      <span className="text-[10px] uppercase tracking-wide text-slate-600">
                        Bench {pick.position - 11}
                      </span>
                    )}
                  </div>
                </td>
                <Cell value={stats?.minutes} />
                <Cell value={stats?.goals_scored} />
                <Cell value={stats?.assists} />
                <Cell value={stats?.clean_sheets} />
                <Cell value={stats?.defensive_contribution} />
                <Cell value={stats?.bps} />
                <Cell value={stats?.bonus} />
                <td className="num pr-1 text-right text-slate-300">{raw}</td>
                <td
                  className={cn(
                    "num px-4 py-1.5 text-right font-bold",
                    pick.position > 11 ? "text-slate-500" : "text-white",
                  )}
                >
                  {pick.position > 11 ? raw : points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {team.history?.current?.length ? (
        <section className="panel px-5 py-4">
          <h2 className="mb-3 text-[14px] font-bold text-white">Season so far</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[12.5px]">
              <thead>
                <tr className="border-b border-pitch-800 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="py-1.5 text-left">GW</th>
                  <th className="text-right">Points</th>
                  <th className="text-right">Bench</th>
                  <th className="text-right">Transfers</th>
                  <th className="text-right">Hits</th>
                  <th className="text-right">GW rank</th>
                  <th className="text-right">Overall</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {[...team.history.current].reverse().map((h) => (
                  <tr key={h.event} className="border-b border-pitch-800/50">
                    <td className="num py-1.5 text-slate-400">{h.event}</td>
                    <td className="num py-1.5 text-right font-bold text-white">{h.points}</td>
                    <td className="num py-1.5 text-right text-slate-500">{h.points_on_bench}</td>
                    <td className="num py-1.5 text-right text-slate-400">{h.event_transfers}</td>
                    <td className="num py-1.5 text-right text-rose-400">
                      {h.event_transfers_cost ? `−${h.event_transfers_cost}` : "0"}
                    </td>
                    <td className="num py-1.5 text-right text-slate-400">
                      {h.rank?.toLocaleString("en-GB") ?? "—"}
                    </td>
                    <td className="num py-1.5 text-right text-slate-300">
                      {h.overall_rank?.toLocaleString("en-GB") ?? "—"}
                    </td>
                    <td className="num py-1.5 text-right text-slate-400">
                      £{(h.value / 10).toFixed(1)}m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {team.source === "fpl" && (
        <EntryForm action="/live" defaultValue={idParam} cta="Load another team" />
      )}
    </div>
  );
}

function Cell({ value }: { value: number | undefined }) {
  return (
    <td className="num pr-1 text-right text-slate-400">
      {value === undefined ? "–" : value}
    </td>
  );
}
