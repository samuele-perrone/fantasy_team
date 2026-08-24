import type { Metadata } from "next";
import { getGameData } from "@/lib/fpl/data";
import { getTeamRuns } from "@/lib/fpl/team-runs";
import { PageHeader, StatCard } from "@/components/ui";
import { FixturesClient } from "./fixtures-client";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Fixture Analyser",
  description:
    "Fixture difficulty ticker for all 20 Premier League clubs, with separate attacking and clean sheet views driven by an expected goals model.",
};

export default async function FixturesPage({ searchParams }: PageProps<"/fixtures">) {
  const params = await searchParams;
  const data = await getGameData();

  const first = data.ctx.nextEvent;
  const last = data.events[data.events.length - 1]?.id ?? 38;
  const rawFrom = Number(Array.isArray(params.from) ? params.from[0] : params.from);
  const rawHorizon = Number(Array.isArray(params.horizon) ? params.horizon[0] : params.horizon);

  const fromEvent = Number.isFinite(rawFrom) ? Math.min(Math.max(rawFrom, 1), last) : first;
  const maxHorizon = Math.max(1, last - fromEvent + 1);
  const horizon = Math.min(
    Number.isFinite(rawHorizon) && rawHorizon > 0 ? rawHorizon : 8,
    maxHorizon,
  );

  const runs = await getTeamRuns(fromEvent, horizon);
  const easiest = [...runs].sort((a, b) => a.avgDifficulty - b.avgDifficulty)[0];
  const bestAttack = [...runs].sort((a, b) => b.totalXGF - a.totalXGF)[0];
  const bestDefence = [...runs].sort((a, b) => b.totalCs - a.totalCs)[0];
  const doubles = runs.filter((t) => Object.values(t.byEvent).some((f) => f.length > 1));
  const blanks = runs.filter((t) => Object.values(t.byEvent).some((f) => f.length === 0));

  return (
    <div>
      <PageHeader
        eyebrow="Toolbox"
        title="Fixture Analyser"
        description={`How hard the games look for every club, gameweek ${fromEvent} to ${fromEvent + horizon - 1}. The attacking and clean sheet views rate each match on the goals we expect rather than on the official number — so the same fixture can be great for your forwards and awful for your defenders.`}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Easiest run"
          value={easiest?.short ?? "—"}
          sub={easiest ? `${easiest.avgDifficulty.toFixed(2)} average difficulty` : undefined}
          tone="brand"
        />
        <StatCard
          label="Most expected goals"
          value={bestAttack?.short ?? "—"}
          sub={bestAttack ? `${bestAttack.totalXGF.toFixed(1)} goals expected over ${horizon} GWs` : undefined}
        />
        <StatCard
          label="Best clean sheet run"
          value={bestDefence?.short ?? "—"}
          sub={bestDefence ? `${bestDefence.totalCs.toFixed(2)} expected clean sheets` : undefined}
        />
        <StatCard
          label="Doubles / blanks"
          value={`${doubles.length} / ${blanks.length}`}
          sub={
            doubles.length
              ? `Doubles: ${doubles.map((t) => t.short).join(", ")}`
              : "No double gameweeks in range"
          }
          tone="warn"
        />
      </div>

      <FixturesClient
        runs={runs}
        fromEvent={fromEvent}
        horizon={horizon}
        maxHorizon={maxHorizon}
      />
    </div>
  );
}
