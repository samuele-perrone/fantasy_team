import type { Metadata } from "next";
import Link from "next/link";
import { EntryForm } from "@/components/entry-form";
import { PageHeader, PositionBadge, StatCard } from "@/components/ui";
import { getGameData } from "@/lib/fpl/data";
import { EntryNotFound, InvalidSquad, resolveTeam, teamQueryString } from "@/lib/fpl/entry";
import { bestXI } from "@/lib/fpl/optimiser";
import type { PlayerRow } from "@/lib/fpl/row";
import { cn, DIFFICULTY_STYLES } from "@/lib/utils";

export const revalidate = 300;

const HORIZON = 8;

export const metadata: Metadata = {
  title: "Transfer & Chip Planner",
  description:
    "Plan your Fantasy Premier League season gameweek by gameweek — projected points per week for your squad, the best windows for each chip and the fixture swings worth planning around.",
};

export default async function PlannerPage({ searchParams }: PageProps<"/planner">) {
  const params = await searchParams;
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const query = teamQueryString(params);
  const data = await getGameData();
  const first = data.ctx.nextEvent;
  const events = Array.from({ length: HORIZON }, (_, i) => first + i).filter((e) => e <= 38);

  let team;
  try {
    team = await resolveTeam(params, HORIZON);
  } catch (e) {
    return (
      <div>
        <PageHeader eyebrow="Planners" title="Transfer & Chip Planner" />
        <EntryForm action="/planner" defaultValue={idParam} />
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
          eyebrow="Planners"
          title="Transfer & Chip Planner"
          description="Load your squad to see a gameweek-by-gameweek projection for the next eight weeks, with the best window for each chip picked out of the same model."
        />
        <EntryForm action="/planner" />
        <div className="panel mt-4 px-5 py-4 text-[13.5px] text-slate-300">
          No team ID, or FPL not showing your picks yet?{" "}
          <Link href="/squad" className="font-semibold text-brand-400 hover:underline">
            Build your squad manually or import it from a screenshot →
          </Link>
        </div>
      </div>
    );
  }

  /** Points a squad member is projected for in one specific gameweek. */
  const pointsIn = (p: PlayerRow, event: number) =>
    p.fixtures.filter((f) => f.event === event).reduce((a, f) => a + f.xPts, 0);

  const weeks = events.map((event) => {
    // Re-rank the squad by that week's projection so the XI reflects that week's fixtures.
    const scoped = team.squad.map((p) => ({ ...p, xPtsNext: pointsIn(p, event) }));
    const xi = bestXI(scoped, "xPtsNext");
    const fixtureCount = team.squad.reduce(
      (a, p) => a + p.fixtures.filter((f) => f.event === event).length,
      0,
    );
    const blanks = team.squad.filter(
      (p) => !p.fixtures.some((f) => f.event === event),
    );
    return {
      event,
      xi,
      starting: xi.startingPoints,
      bench: xi.benchPoints,
      captain: xi.captain,
      total: xi.startingPoints + (xi.captain?.xPtsNext ?? 0),
      fixtureCount,
      blanks,
      doubles: team.squad.filter((p) => p.fixtures.filter((f) => f.event === event).length > 1),
    };
  });

  const maxTotal = Math.max(...weeks.map((w) => w.total), 1);
  const benchBoost = [...weeks].sort((a, b) => b.bench - a.bench)[0];
  const tripleCaptain = [...weeks].sort(
    (a, b) => (b.captain?.xPtsNext ?? 0) - (a.captain?.xPtsNext ?? 0),
  )[0];
  const freeHit = [...weeks].sort((a, b) => a.starting - b.starting)[0];
  const wildcard = [...weeks].sort((a, b) => b.blanks.length - a.blanks.length)[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Planners"
        title="Transfer & Chip Planner"
        description={`${team.name} · projected week by week from gameweek ${events[0]} to ${events[events.length - 1]}, using the current 15 with no transfers applied.`}
      >
        <Link
          href={`/transfers?${query}`}
          className="rounded-lg bg-brand-500 px-4 py-2 text-[13px] font-bold text-pitch-950 transition hover:bg-brand-400"
        >
          AI transfers →
        </Link>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Bench Boost window"
          value={`GW${benchBoost.event}`}
          sub={`${benchBoost.bench.toFixed(1)} projected off the bench`}
          tone="brand"
        />
        <StatCard
          label="Triple Captain window"
          value={`GW${tripleCaptain.event}`}
          sub={
            tripleCaptain.captain
              ? `${tripleCaptain.captain.name} at ${tripleCaptain.captain.xPtsNext.toFixed(2)} xPts`
              : undefined
          }
          tone="brand"
        />
        <StatCard
          label="Weakest week"
          value={`GW${freeHit.event}`}
          sub={`${freeHit.starting.toFixed(1)} from your XI — Free Hit candidate`}
          tone="warn"
        />
        <StatCard
          label="Most blanks"
          value={`GW${wildcard.event}`}
          sub={`${wildcard.blanks.length} of your 15 without a fixture`}
          tone="warn"
        />
      </div>

      <section className="panel px-5 py-5">
        <h2 className="mb-4 text-[14px] font-bold text-white">Projected points per gameweek</h2>
        <div className="flex items-end gap-2 overflow-x-auto pb-1">
          {weeks.map((w) => (
            <div key={w.event} className="flex min-w-[52px] flex-1 flex-col items-center gap-1">
              <span className="num text-[11px] font-bold text-white">{w.total.toFixed(0)}</span>
              <div className="flex w-full flex-col justify-end" style={{ height: 150 }}>
                <div
                  className="w-full rounded-t bg-brand-500"
                  style={{ height: `${(w.starting / maxTotal) * 150}px` }}
                  title={`XI ${w.starting.toFixed(1)} xPts`}
                />
                <div
                  className="w-full bg-accent-500/70"
                  style={{ height: `${((w.captain?.xPtsNext ?? 0) / maxTotal) * 150}px` }}
                  title={`Captain bonus ${(w.captain?.xPtsNext ?? 0).toFixed(1)}`}
                />
                <div
                  className="w-full rounded-b bg-pitch-600"
                  style={{ height: `${(w.bench / maxTotal) * 150}px` }}
                  title={`Bench ${w.bench.toFixed(1)} xPts`}
                />
              </div>
              <span className="text-[10.5px] font-semibold text-slate-500">GW{w.event}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500">
          <Legend color="bg-brand-500">Starting XI</Legend>
          <Legend color="bg-accent-500/70">Captain bonus</Legend>
          <Legend color="bg-pitch-600">Bench</Legend>
        </div>
      </section>

      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[860px] text-[13px]">
          <thead>
            <tr className="border-b border-pitch-700 text-[10.5px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2 text-left">GW</th>
              <th className="text-right">XI</th>
              <th className="text-right">Captain</th>
              <th className="text-left">Best armband</th>
              <th className="text-right">Bench</th>
              <th className="text-right">Total</th>
              <th className="text-right">Fixtures</th>
              <th className="px-4 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.event} className="border-b border-pitch-800/60 hover:bg-pitch-800/40">
                <td className="num px-4 py-2 font-bold text-white">{w.event}</td>
                <td className="num pr-1 text-right text-slate-300">{w.starting.toFixed(1)}</td>
                <td className="num pr-1 text-right text-accent-400">
                  +{(w.captain?.xPtsNext ?? 0).toFixed(1)}
                </td>
                <td className="py-2">
                  {w.captain ? (
                    <span className="flex items-center gap-2">
                      <PositionBadge pos={w.captain.pos} />
                      <span className="font-semibold text-white">{w.captain.name}</span>
                      <span className="text-[11px] text-slate-500">{w.captain.team}</span>
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="num pr-1 text-right text-slate-400">{w.bench.toFixed(1)}</td>
                <td className="num pr-1 text-right font-bold text-brand-400">
                  {w.total.toFixed(1)}
                </td>
                <td className="num pr-1 text-right text-slate-400">{w.fixtureCount}</td>
                <td className="px-4 py-2 text-[12px]">
                  <span className="flex flex-wrap gap-1.5">
                    {w.event === benchBoost.event && <Tag tone="brand">Bench Boost</Tag>}
                    {w.event === tripleCaptain.event && <Tag tone="accent">Triple Captain</Tag>}
                    {w.event === freeHit.event && <Tag tone="warn">Free Hit</Tag>}
                    {w.doubles.length > 0 && (
                      <Tag tone="accent">{w.doubles.length} double{w.doubles.length > 1 ? "s" : ""}</Tag>
                    )}
                    {w.blanks.length > 0 && (
                      <Tag tone="warn">{w.blanks.length} blank{w.blanks.length > 1 ? "s" : ""}</Tag>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel px-5 py-4">
        <h2 className="mb-3 text-[14px] font-bold text-white">Your squad&apos;s fixture grid</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[12.5px]">
            <thead>
              <tr className="border-b border-pitch-800 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="py-1.5 text-left">Player</th>
                {events.map((e) => (
                  <th key={e} className="px-1 text-center">
                    {e}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...team.squad]
                .sort((a, b) => a.posId - b.posId || b.xPts - a.xPts)
                .map((p) => (
                  <tr key={p.id} className="border-b border-pitch-800/50">
                    <td className="py-1.5">
                      <span className="flex items-center gap-1.5">
                        <PositionBadge pos={p.pos} />
                        <span className="font-semibold text-white">{p.name}</span>
                      </span>
                    </td>
                    {events.map((e) => {
                      const fx = p.fixtures.filter((f) => f.event === e);
                      if (!fx.length) {
                        return (
                          <td key={e} className="px-1 py-1.5 text-center">
                            <span className="inline-block h-5 w-full min-w-[44px] rounded bg-pitch-800 text-[9.5px] font-bold leading-5 text-slate-600">
                              —
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td key={e} className="px-1 py-1.5">
                          <div className="flex flex-col gap-0.5">
                            {fx.map((f, i) => (
                              <span
                                key={i}
                                title={`${f.isHome ? "vs" : "at"} ${f.opponent} · ${f.xPts.toFixed(2)} xPts`}
                                className={cn(
                                  "block min-w-[44px] rounded text-center text-[10px] font-bold leading-5",
                                  DIFFICULTY_STYLES[f.difficulty],
                                )}
                              >
                                {f.isHome ? f.opponent.toUpperCase() : f.opponent.toLowerCase()}
                              </span>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {team.source === "fpl" && (
        <EntryForm action="/planner" defaultValue={idParam} cta="Load another team" />
      )}
    </div>
  );
}

function Legend({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2.5 w-4 rounded-sm", color)} />
      {children}
    </span>
  );
}

function Tag({ tone, children }: { tone: "brand" | "accent" | "warn"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide",
        tone === "brand" && "bg-brand-500/20 text-brand-400",
        tone === "accent" && "bg-accent-500/20 text-accent-400",
        tone === "warn" && "bg-amber-500/20 text-amber-300",
      )}
    >
      {children}
    </span>
  );
}
