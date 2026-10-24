import { bestXI, optimiseSquad } from "./optimiser";
import type { PlayerRow } from "./row";
import { DEFAULT_RULES, type SquadRules } from "./rules";

/**
 * The best squad a wildcard could buy: all fifteen sold, the money spent again on the most
 * expected points over the next five gameweeks.
 *
 * The squad is chosen on five gameweeks (`xPts`) because a wildcard squad has to last, and
 * the XI shown is then set for the next gameweek alone (`xPtsNext`), like a manager would.
 */

/**
 * Below this many points over five gameweeks, the wildcard is not worth spending: it is one
 * chip a half-season, and ~2 points a week across an XI is inside what the model gets wrong.
 * A starting value, not a fitted one.
 */
export const WILDCARD_WORTH = 10;

/**
 * What FPL would pay for a player, estimated cautiously. FPL keeps half of any rise since
 * purchase (rounded down to £0.1m) and its public endpoints do not say what anyone paid, so a
 * player who has risen since the season started is assumed bought at the opening price. A
 * real selling price can only be higher, so the squad suggested is always affordable.
 */
export function estimateSellingPrice(p: Pick<PlayerRow, "cost" | "costChangeStart">): number {
  const rise = Math.round(p.costChangeStart * 10);
  if (rise <= 0) return p.cost;
  const start = Math.round(p.cost * 10) - rise;
  return (start + Math.floor(rise / 2)) / 10;
}

export interface WildcardPlan {
  /** bank plus the estimated selling value of the current fifteen, in £m */
  budget: number;
  cost: number;
  formation: string;
  /** set for the next gameweek */
  starters: PlayerRow[];
  bench: PlayerRow[];
  captainId: number | null;
  viceId: number | null;
  /** the new squad's best XI, expected points over the next five gameweeks */
  points: number;
  /** the same for the current squad, without a wildcard */
  currentPoints: number;
  gain: number;
  /** players the new squad keeps from the current one */
  keptIds: number[];
  /** the gain is too small to be worth the chip */
  saveIt: boolean;
  /** watched players the squad was built around, when asked to use the watchlist */
  watchIds: number[];
  /** watched players left out: unavailable, or no legal squad within budget could hold them */
  watchSkipped: { id: number; name: string }[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Which watched players a wildcard squad can be built around: tried best first, each kept only
 * if a full legal squad within budget still exists with it. Forcing them all in at once would
 * make the optimiser give up on any set that breaks a quota, the club limit or the budget.
 */
function fitWatched(
  watched: PlayerRow[],
  pool: PlayerRow[],
  budget: number,
  rules: SquadRules,
): { locked: PlayerRow[]; skipped: PlayerRow[] } {
  const locked: PlayerRow[] = [];
  const skipped: PlayerRow[] = [];
  for (const p of [...watched].sort((a, b) => b.xPts - a.xPts)) {
    // The optimiser never picks an unavailable player, so neither is one built around.
    if (p.status === "u" || p.status === "n") {
      skipped.push(p);
      continue;
    }
    const trial = [...locked, p];
    const r = optimiseSquad(pool, {
      budget,
      key: "xPts",
      includeCaptain: true,
      rules,
      locked: trial.map((t) => t.id),
    });
    const ids = new Set(r.squad.map((s) => s.id));
    if (r.squad.length === rules.squadSize && trial.every((t) => ids.has(t.id))) locked.push(p);
    else skipped.push(p);
  }
  return { locked, skipped };
}

export function planWildcard(input: {
  squad: PlayerRow[];
  pool: PlayerRow[];
  bank: number;
  rules?: SquadRules;
  /** build around these watched players where they fit */
  watched?: PlayerRow[];
}): WildcardPlan {
  const rules = input.rules ?? DEFAULT_RULES;
  const budget = round1(
    input.bank + input.squad.reduce((a, p) => a + estimateSellingPrice(p), 0),
  );
  const { locked, skipped } = fitWatched(input.watched ?? [], input.pool, budget, rules);
  // Squad players are in the pool too, so keeping one is a choice the optimiser can make.
  const result = optimiseSquad(input.pool, {
    budget,
    key: "xPts",
    includeCaptain: true,
    rules,
    locked: locked.map((p) => p.id),
  });
  const xi = bestXI(result.squad, "xPtsNext", undefined, rules);
  const points = bestXI(result.squad, "xPts", undefined, rules).startingPoints;
  const currentPoints = bestXI(input.squad, "xPts", undefined, rules).startingPoints;
  const owned = new Set(input.squad.map((p) => p.id));
  const gain = round1(points - currentPoints);

  return {
    budget,
    cost: round1(result.cost),
    formation: xi.formation,
    starters: xi.starters,
    bench: xi.bench,
    captainId: xi.captain?.id ?? null,
    viceId: xi.viceCaptain?.id ?? null,
    points: round1(points),
    currentPoints: round1(currentPoints),
    gain,
    keptIds: result.squad.filter((p) => owned.has(p.id)).map((p) => p.id),
    saveIt: gain < WILDCARD_WORTH,
    watchIds: locked.map((p) => p.id),
    watchSkipped: skipped.map((p) => ({ id: p.id, name: p.name })),
  };
}
