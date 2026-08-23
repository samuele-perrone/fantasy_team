import type { Metadata } from "next";
import Link from "next/link";
import { EntryForm } from "@/components/entry-form";
import { Pitch } from "@/components/pitch";
import { PageHeader, FixtureRun, PositionBadge, StatCard } from "@/components/ui";
import { EntryNotFound, InvalidSquad, resolveTeam, teamQueryString } from "@/lib/fpl/entry";
import { optimiseSquad, planTransfers, type TransferPlan } from "@/lib/fpl/optimiser";
import { cn, money } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "AI Transfers",
  description:
    "Ranked Fantasy Premier League transfer suggestions for your squad, scored on projected points gained over the next five gameweeks and net of any points hit.",
};

export default async function TransfersPage({ searchParams }: PageProps<"/transfers">) {
  const params = await searchParams;
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const query = teamQueryString(params);

  let team;
  try {
    team = await resolveTeam(params, 5);
  } catch (e) {
    return (
      <div>
        <PageHeader eyebrow="My Team" title="AI Transfers" />
        <EntryForm action="/transfers" defaultValue={idParam} />
        <div className="panel mt-4 px-5 py-4 text-[13.5px] text-amber-300">
          {e instanceof EntryNotFound || e instanceof InvalidSquad
            ? e.message
            : "Could not load that squad right now. Try again shortly."}
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div>
        <PageHeader
          eyebrow="My Team"
          title="AI Transfers"
          description="Load your squad and the model searches every legal single, double and triple transfer, scoring each on projected points gained across the next five gameweeks and charging 4 points for every move beyond your free transfers."
        />
        <EntryForm action="/transfers" />
        <div className="panel mt-4 px-5 py-4 text-[13.5px] text-slate-300">
          No team ID, or FPL not showing your picks yet?{" "}
          <Link href="/squad" className="font-semibold text-brand-400 hover:underline">
            Build your squad manually or import it from a screenshot →
          </Link>
        </div>
      </div>
    );
  }

  const squadIds = new Set(team.squad.map((p) => p.id));
  const pool = team.pool.filter(
    (p) => !squadIds.has(p.id) && p.status !== "u" && p.status !== "n" && p.xMins > 20,
  );

  const plans = planTransfers(team.squad, pool, {
    bank: team.bank,
    freeTransfers: team.freeTransfers,
    maxTransfers: 3,
    key: "xPts",
    rules: team.rules,
  });

  const wildcard = optimiseSquad(team.pool, {
    budget: team.squadValue + team.bank,
    key: "xPts",
    benchWeight: 0.12,
    rules: team.rules,
  });
  const currentScore = team.squad.reduce((a, p) => a + p.xPts, 0);
  const wildcardGain = wildcard.xi.startingPoints - team.xi.starters.reduce((a, p) => a + p.xPts, 0);

  const bestPlan = plans.reduce<TransferPlan | null>(
    (best, p) => (!best || p.netGain > best.netGain ? p : best),
    null,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My Team"
        title="AI Transfers"
        description={`${team.name} · ${money(team.bank)} in the bank · ${team.freeTransfers} free transfer${team.freeTransfers === 1 ? "" : "s"} · projections over the next 5 gameweeks.`}
      >
        <Link
          href={`/my-team?${query}`}
          className="rounded-lg border border-pitch-600 px-4 py-2 text-[13px] font-bold text-slate-300 transition hover:border-brand-500 hover:text-white"
        >
          ← Squad
        </Link>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="In the bank" value={money(team.bank)} sub={`Squad ${money(team.squadValue)}`} />
        <StatCard label="Free transfers" value={team.freeTransfers} sub="Hits cost 4 pts each" />
        <StatCard
          label="Best plan"
          value={bestPlan ? `${bestPlan.moves.length} move${bestPlan.moves.length > 1 ? "s" : ""}` : "Hold"}
          sub={bestPlan ? `+${bestPlan.netGain.toFixed(2)} pts after hits` : "No move beats holding"}
          tone="brand"
        />
        <StatCard
          label="Wildcard upside"
          value={`${wildcardGain >= 0 ? "+" : ""}${wildcardGain.toFixed(1)}`}
          sub="vs your current XI over 5 GWs"
          tone="warn"
        />
      </div>

      {!plans.length ? (
        <div className="panel px-6 py-10 text-center text-[13.5px] text-slate-400">
          The model cannot find a transfer that improves your projected points — hold your
          transfer this week.
        </div>
      ) : (
        <section className="space-y-4">
          <h2 className="text-[15px] font-bold text-white">Transfer plans</h2>
          {plans.map((plan, i) => (
            <div
              key={i}
              className={cn(
                "panel px-5 py-4",
                plan === bestPlan && "border-brand-500/60 ring-1 ring-brand-500/20",
              )}
            >
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h3 className="text-[14px] font-bold text-white">
                  {plan.moves.length} transfer{plan.moves.length > 1 ? "s" : ""}
                </h3>
                {plan === bestPlan && (
                  <span className="rounded bg-brand-500/20 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-brand-400">
                    Recommended
                  </span>
                )}
                <div className="ml-auto flex items-center gap-4 text-[12.5px]">
                  <span className="text-slate-400">
                    Gain <strong className="num text-white">+{plan.gain.toFixed(2)}</strong>
                  </span>
                  <span className="text-slate-400">
                    Hit{" "}
                    <strong className="num text-rose-400">
                      {plan.hitCost ? `−${plan.hitCost}` : "0"}
                    </strong>
                  </span>
                  <span
                    className={cn(
                      "num rounded px-2 py-0.5 font-bold",
                      plan.netGain > 0
                        ? "bg-brand-500/20 text-brand-400"
                        : "bg-rose-500/15 text-rose-400",
                    )}
                  >
                    Net {plan.netGain >= 0 ? "+" : ""}
                    {plan.netGain.toFixed(2)}
                  </span>
                </div>
              </div>

              <ul className="space-y-2">
                {plan.moves.map((m) => (
                  <li
                    key={m.out.id}
                    className="grid items-center gap-3 rounded-lg bg-pitch-900/60 px-3 py-2 sm:grid-cols-[1fr_auto_1fr]"
                  >
                    <MoveSide row={m.out} tone="out" />
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="text-brand-400">→</span>
                      <span className="num">
                        {m.cost > 0 ? `−${money(m.cost)}` : m.cost < 0 ? `+${money(-m.cost)}` : "£0.0m"}
                      </span>
                    </div>
                    <MoveSide row={m.in} tone="in" />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <section>
        <h2 className="mb-1 text-[15px] font-bold text-white">Wildcard draft</h2>
        <p className="mb-3 text-[13px] text-slate-400">
          The best legal 15 the optimiser can build with your {money(team.squadValue + team.bank)}{" "}
          budget, ignoring your current squad entirely. Projected {wildcard.xi.startingPoints.toFixed(1)}{" "}
          points from the starting XI over the next 5 gameweeks.
        </p>
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Pitch xi={wildcard.xi} metric="xPts" metricLabel="5 GW" teamCodes={team.teamCodes} />
          <div className="panel px-5 py-4">
            <h3 className="mb-2.5 text-[13.5px] font-bold text-white">Changes from your squad</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-brand-400">
                  In
                </div>
                <ul className="space-y-1.5">
                  {wildcard.squad
                    .filter((p) => !squadIds.has(p.id))
                    .sort((a, b) => b.xPts - a.xPts)
                    .map((p) => (
                      <li key={p.id} className="flex items-center gap-2 text-[12.5px]">
                        <PositionBadge pos={p.pos} />
                        <span className="font-semibold text-white">{p.name}</span>
                        <span className="num ml-auto text-slate-400">{money(p.cost)}</span>
                      </li>
                    ))}
                </ul>
              </div>
              <div>
                <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-rose-400">
                  Out
                </div>
                <ul className="space-y-1.5">
                  {team.squad
                    .filter((p) => !wildcard.squad.some((w) => w.id === p.id))
                    .sort((a, b) => a.xPts - b.xPts)
                    .map((p) => (
                      <li key={p.id} className="flex items-center gap-2 text-[12.5px]">
                        <PositionBadge pos={p.pos} />
                        <span className="font-semibold text-slate-300">{p.name}</span>
                        <span className="num ml-auto text-slate-500">{money(p.cost)}</span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
            <p className="mt-4 border-t border-pitch-800 pt-3 text-[11.5px] text-slate-500">
              Your current 15 project {currentScore.toFixed(1)} points across all players over the
              same window, at a squad cost of {money(team.squadValue)}.
            </p>
          </div>
        </div>
      </section>

      {team.source === "fpl" && (
        <EntryForm action="/transfers" defaultValue={idParam} cta="Load another team" />
      )}
    </div>
  );
}

function MoveSide({
  row,
  tone,
}: {
  row: import("@/lib/fpl/row").PlayerRow;
  tone: "in" | "out";
}) {
  return (
    <div className={cn("flex items-center gap-2", tone === "out" && "opacity-70")}>
      <PositionBadge pos={row.pos} />
      <Link
        href={`/players/${row.id}`}
        className={cn(
          "text-[13px] font-bold hover:underline",
          tone === "in" ? "text-brand-400" : "text-slate-300",
        )}
      >
        {row.name}
      </Link>
      <span className="num text-[11.5px] text-slate-500">
        {row.team} · {money(row.cost)} · {row.xPts.toFixed(1)}
      </span>
      <span className="ml-auto hidden sm:block">
        <FixtureRun fixtures={row.fixtures} max={4} />
      </span>
    </div>
  );
}
