import type { PlayerRow } from "./row";
import type { ProjectionContext } from "./projection";
import { attackingMultiplier, cleanSheetProbability, expectedGoals } from "./ratings";

/**
 * Projections are means, and a mean says nothing about a good week.
 *
 * A squad projecting 41 does not score 41 — it scores somewhere in a wide, right-skewed
 * range, because FPL points arrive in lumps of 4 to 13. Asking "how do I score 80" is a
 * question about the tail of that distribution, which a single expected value cannot answer.
 *
 * This resamples each player's gameweek from the same components the projection is built
 * from, so the distribution is consistent with the model rather than a separate guess.
 */

const GOAL_POINTS: Record<number, number> = { 1: 10, 2: 6, 3: 5, 4: 4 };
const CS_POINTS: Record<number, number> = { 1: 4, 2: 4, 3: 1, 4: 0 };
const DC_THRESHOLD: Record<number, number> = { 1: 99, 2: 10, 3: 12, 4: 12 };

/** Knuth's method — fine at the small rates involved here. */
function poisson(lambda: number): number {
  if (lambda <= 0) return 0;
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > limit);
  return k - 1;
}

function samplePlayer(row: PlayerRow, ctx: ProjectionContext, event: number): number {
  const fixtures = (ctx.fixturesByTeam.get(row.teamId) ?? []).filter((f) => f.event === event);
  if (!fixtures.length) return 0;

  let total = 0;
  for (const fixture of fixtures) {
    const isHome = fixture.team_h === row.teamId;
    const team = ctx.ratings.get(row.teamId);
    const opponent = ctx.ratings.get(isHome ? fixture.team_a : fixture.team_h);
    if (!team || !opponent) continue;

    const started = Math.random() < row.startProb;
    // Non-starters mostly do not appear at all; when they do it is a short cameo.
    if (!started && Math.random() > 0.25) continue;

    const minutes = started ? 90 : 20;
    const share = minutes / 90;
    let points = minutes >= 60 ? 2 : 1;

    const attack = attackingMultiplier(team, opponent, isHome);
    points += poisson(row.xG90 * attack * share) * GOAL_POINTS[row.posId];
    points += poisson(row.xA90 * attack * share) * 3;

    if (minutes >= 60 && Math.random() < cleanSheetProbability(team, opponent, isHome)) {
      points += CS_POINTS[row.posId];
    }

    const threshold = DC_THRESHOLD[row.posId];
    if (threshold < 99 && row.dc90 > 0) {
      if (Math.random() < Math.min((row.dc90 * share) / threshold, 0.45)) points += 2;
    }

    if (row.posId <= 2) {
      points -= Math.floor(poisson(expectedGoals(opponent, team, !isHome) * share) / 2);
    }

    // Bonus is awarded to three players per match, so roughly a quarter of starters get some.
    if (started && Math.random() < 0.28) points += 1 + Math.floor(Math.random() * 3);

    total += points;
  }
  return Math.max(total, -2);
}

export interface Outcome {
  median: number;
  /** the middle half of weeks fall between these */
  lower: number;
  upper: number;
  /** a good week for this squad, and a great one */
  p90: number;
  p99: number;
  chanceOf60: number;
  chanceOf80: number;
  chanceOf100: number;
  mean: number;
}

export function simulateGameweek(
  starters: PlayerRow[],
  captain: PlayerRow | null,
  ctx: ProjectionContext,
  event: number,
  {
    runs = 4000,
    captainMultiplier = 2,
    bench = [],
  }: { runs?: number; captainMultiplier?: number; bench?: PlayerRow[] } = {},
): Outcome {
  const totals = new Array<number>(runs);

  for (let i = 0; i < runs; i++) {
    let sum = 0;
    for (const p of starters) {
      const pts = samplePlayer(p, ctx, event);
      sum += p.id === captain?.id ? pts * captainMultiplier : pts;
    }
    for (const p of bench) sum += samplePlayer(p, ctx, event);
    totals[i] = sum;
  }

  totals.sort((a, b) => a - b);
  const at = (q: number) => totals[Math.min(runs - 1, Math.floor(runs * q))];
  const atLeast = (x: number) => totals.filter((t) => t >= x).length / runs;

  return {
    median: at(0.5),
    lower: at(0.25),
    upper: at(0.75),
    p90: at(0.9),
    p99: at(0.99),
    chanceOf60: atLeast(60),
    chanceOf80: atLeast(80),
    chanceOf100: atLeast(100),
    mean: totals.reduce((a, b) => a + b, 0) / runs,
  };
}
