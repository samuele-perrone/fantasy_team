import type { PlayerRow } from "./data";
import { rowNewsLabel } from "./news";
import { DEFAULT_RULES, formationsFor, type SquadRules } from "./rules";

// Derived from one definition rather than restated here, so the optimiser and the rest of
// the app cannot disagree about the rules. Callers holding live rules from FPL should pass
// them in; these defaults are what the app was built against.
export const SQUAD_QUOTA: Record<number, number> = DEFAULT_RULES.quota;
export const TEAM_LIMIT = DEFAULT_RULES.teamLimit;

/** Every legal outfield shape: 1 GK plus 10 outfielders within FPL's positional minimums. */
export const FORMATIONS: [number, number, number][] = formationsFor(DEFAULT_RULES);

export interface XI {
  starters: PlayerRow[];
  bench: PlayerRow[];
  captain: PlayerRow | null;
  viceCaptain: PlayerRow | null;
  formation: string;
  startingPoints: number;
  benchPoints: number;
}

const score = (p: PlayerRow, key: keyof PlayerRow) => Number(p[key]) || 0;

/**
 * Pick the highest-scoring legal XI out of a 15-man squad. Pass `formation` to lock the
 * shape rather than letting it float to whichever shape scores best.
 */
export function bestXI(
  squad: PlayerRow[],
  key: keyof PlayerRow = "xPtsNext",
  formation?: [number, number, number],
  rules: SquadRules = DEFAULT_RULES,
): XI {
  const byPos = (pos: number) =>
    squad.filter((p) => p.posId === pos).sort((a, b) => score(b, key) - score(a, key));

  const gks = byPos(1);
  const defs = byPos(2);
  const mids = byPos(3);
  const fwds = byPos(4);

  let best: XI | null = null;
  const shapes = formation ? [formation] : formationsFor(rules);

  for (const [d, m, f] of shapes) {
    if (defs.length < d || mids.length < m || fwds.length < f || !gks.length) continue;
    const starters = [gks[0], ...defs.slice(0, d), ...mids.slice(0, m), ...fwds.slice(0, f)];
    const total = starters.reduce((a, p) => a + score(p, key), 0);
    if (!best || total > best.startingPoints) {
      const starterIds = new Set(starters.map((p) => p.id));
      const bench = squad
        .filter((p) => !starterIds.has(p.id))
        .sort((a, b) => {
          // Bench order: reserve keeper last, then by projection.
          if (a.posId === 1 !== (b.posId === 1)) return a.posId === 1 ? 1 : -1;
          return score(b, key) - score(a, key);
        });
      const ranked = [...starters].sort((a, b) => score(b, key) - score(a, key));
      best = {
        starters,
        bench,
        captain: ranked[0] ?? null,
        viceCaptain: ranked[1] ?? null,
        formation: `${d}-${m}-${f}`,
        startingPoints: total,
        benchPoints: bench.reduce((a, p) => a + score(p, key), 0),
      };
    }
  }

  return (
    best ?? {
      starters: [],
      bench: squad,
      captain: null,
      viceCaptain: null,
      formation: "—",
      startingPoints: 0,
      benchPoints: 0,
    }
  );
}

export interface OptimiseOptions {
  /** budget in £m, e.g. 100 */
  budget: number;
  /** which projection field to maximise */
  key?: keyof PlayerRow;
  /** how much a bench point is worth relative to a starting point */
  benchWeight?: number;
  /** player ids that must appear in the squad */
  locked?: number[];
  /** player ids that may never be picked */
  banned?: number[];
  /** captaincy doubles the best starter's score when true */
  includeCaptain?: boolean;

  /**
   * Minimum probability of starting, 0–1. This is the right measure of "plays the full
   * match" — expected minutes are probability weighted and top out near 76 across the whole
   * game, so a threshold like 80 minutes would match nobody.
   */
  minStartProb?: number;
  /** exclude anyone injured, doubtful, suspended or just back from injury */
  fitOnly?: boolean;
  /** maximum fixture difficulty of the player's next match */
  maxNextDifficulty?: number;
  /**
   * Extra objective weight for penalty takers, in projected points. A preference rather
   * than a filter: no goalkeeper and only two defenders in the game take penalties, so
   * requiring them outright cannot fill a legal squad.
   */
  penaltyBonus?: number;
  /** lock the starting shape, e.g. [3, 4, 3] */
  formation?: [number, number, number];
  /** squad rules as published by FPL; defaults to what the app was built against */
  rules?: SquadRules;
}

export interface OptimiseResult {
  squad: PlayerRow[];
  xi: XI;
  cost: number;
  objective: number;
  iterations: number;
  /** filters dropped to reach a legal squad, in the order they were given up */
  relaxed: string[];
}

/** Preference weight added to a player's score, currently only for penalty takers. */
function bonusFor(p: PlayerRow, penaltyBonus: number): number {
  if (!penaltyBonus || p.penaltyOrder === null) return 0;
  // Second choice is worth materially less than first.
  return p.penaltyOrder === 1 ? penaltyBonus : penaltyBonus * 0.4;
}

interface State {
  squad: PlayerRow[];
  cost: number;
  counts: Record<number, number>;
  clubs: Map<number, number>;
}

function objectiveOf(
  squad: PlayerRow[],
  opts: Required<Pick<OptimiseOptions, "key" | "benchWeight" | "includeCaptain">> & {
    penaltyBonus: number;
    formation?: [number, number, number];
    rules: SquadRules;
  },
) {
  const xi = bestXI(squad, opts.key, opts.formation, opts.rules);
  const captainBonus = opts.includeCaptain && xi.captain ? score(xi.captain, opts.key) : 0;
  // Preferences count only for the eleven that actually play.
  const preference = xi.starters.reduce((a, p) => a + bonusFor(p, opts.penaltyBonus), 0);
  return xi.startingPoints + captainBonus + preference + xi.benchPoints * opts.benchWeight;
}

/** Ascending price list per position, for costing out the cheapest possible completion. */
type PriceFloors = Record<number, number[]>;

function priceFloors(pool: PlayerRow[]): PriceFloors {
  const floors: PriceFloors = { 1: [], 2: [], 3: [], 4: [] };
  for (const p of pool) floors[p.posId]?.push(p.cost);
  for (const pos of [1, 2, 3, 4]) floors[pos].sort((a, b) => a - b);
  return floors;
}

/**
 * Lower bound on what it costs to finish the squad from here — the sum of the cheapest
 * players still needed in each position. A flat per-slot estimate is wrong because positions
 * have very different price floors, and overestimating makes the greedy reject affordable
 * picks and fail outright on a tight budget.
 */
function minCostToComplete(
  counts: Record<number, number>,
  floors: PriceFloors,
  rules: SquadRules,
): number {
  let total = 0;
  for (const pos of [1, 2, 3, 4]) {
    const needed = rules.quota[pos] - counts[pos];
    for (let i = 0; i < needed; i++) total += floors[pos][i] ?? 4.0;
  }
  return total;
}

function canAdd(
  state: State,
  p: PlayerRow,
  budget: number,
  floors: PriceFloors,
  rules: SquadRules,
): boolean {
  if (state.counts[p.posId] >= rules.quota[p.posId]) return false;
  if ((state.clubs.get(p.teamId) ?? 0) >= rules.teamLimit) return false;

  // Cost of completing the squad once this player is in.
  const after = { ...state.counts, [p.posId]: state.counts[p.posId] + 1 };
  return state.cost + p.cost + minCostToComplete(after, floors, rules) <= budget + 1e-9;
}

function greedy(
  pool: PlayerRow[],
  lambda: number,
  opts: Required<Pick<OptimiseOptions, "key">>,
  budget: number,
  locked: PlayerRow[],
  floors: PriceFloors,
  rules: SquadRules,
): PlayerRow[] | null {
  const state: State = { squad: [], cost: 0, counts: { 1: 0, 2: 0, 3: 0, 4: 0 }, clubs: new Map() };

  const push = (p: PlayerRow) => {
    state.squad.push(p);
    state.cost += p.cost;
    state.counts[p.posId]++;
    state.clubs.set(p.teamId, (state.clubs.get(p.teamId) ?? 0) + 1);
  };

  for (const p of locked) {
    if (state.counts[p.posId] >= rules.quota[p.posId]) continue;
    if ((state.clubs.get(p.teamId) ?? 0) >= rules.teamLimit) continue;
    push(p);
  }
  if (state.cost > budget) return null;

  const lockedIds = new Set(locked.map((p) => p.id));
  const ranked = pool
    .filter((p) => !lockedIds.has(p.id))
    .map((p) => ({ p, v: score(p, opts.key) - lambda * p.cost }))
    .sort((a, b) => b.v - a.v);

  for (const { p } of ranked) {
    if (state.squad.length === rules.squadSize) break;
    if (canAdd(state, p, budget, floors, rules)) push(p);
  }

  return state.squad.length === rules.squadSize ? state.squad : null;
}

/**
 * Cheapest legal 15, used as a fallback seed. Fills each position from the cheapest players
 * available, so it succeeds whenever the budget can accommodate any legal squad at all.
 */
function cheapestLegal(
  pool: PlayerRow[],
  budget: number,
  locked: PlayerRow[],
  rules: SquadRules,
): PlayerRow[] | null {
  const squad: PlayerRow[] = [];
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const clubs = new Map<number, number>();
  let cost = 0;

  const take = (p: PlayerRow) => {
    squad.push(p);
    cost += p.cost;
    counts[p.posId]++;
    clubs.set(p.teamId, (clubs.get(p.teamId) ?? 0) + 1);
  };

  for (const p of locked) {
    if (counts[p.posId] >= rules.quota[p.posId]) continue;
    if ((clubs.get(p.teamId) ?? 0) >= rules.teamLimit) continue;
    take(p);
  }

  const lockedIds = new Set(locked.map((p) => p.id));
  const byPrice = pool
    .filter((p) => !lockedIds.has(p.id))
    .sort((a, b) => a.cost - b.cost || b.xPts - a.xPts);

  for (const pos of [1, 2, 3, 4]) {
    for (const p of byPrice) {
      if (counts[pos] >= rules.quota[pos]) break;
      if (p.posId !== pos || squad.some((s) => s.id === p.id)) continue;
      if ((clubs.get(p.teamId) ?? 0) >= rules.teamLimit) continue;
      take(p);
    }
  }

  return squad.length === rules.squadSize && cost <= budget + 1e-9 ? squad : null;
}

/**
 * Squad selection is a knapsack with quota and club-limit side constraints, so it is solved
 * with a Lagrangian-style greedy sweep over price penalties followed by steepest-ascent
 * single-player swaps until no improvement remains.
 */
export function optimiseSquad(players: PlayerRow[], options: OptimiseOptions): OptimiseResult {
  const key = options.key ?? "xPts";
  const benchWeight = options.benchWeight ?? 0.12;
  const includeCaptain = options.includeCaptain ?? false;
  const penaltyBonus = options.penaltyBonus ?? 0;
  const formation = options.formation;
  const rules = options.rules ?? DEFAULT_RULES;
  const opts = { key, benchWeight, includeCaptain, penaltyBonus, formation, rules };
  const budget = options.budget;

  const banned = new Set(options.banned ?? []);
  const base = players.filter(
    (p) => !banned.has(p.id) && p.status !== "u" && p.status !== "n" && p.cost <= budget,
  );
  const byId = new Map(players.map((p) => [p.id, p]));
  const locked = (options.locked ?? [])
    .map((id) => byId.get(id))
    .filter((p): p is PlayerRow => Boolean(p))
    .slice(0, rules.squadSize);

  /**
   * Filters are applied hardest-first and dropped one at a time until a legal squad exists.
   * Requesting nailed starters with easy fixtures can leave too few players to fill a
   * position, and silently returning nothing would be worse than returning a squad and
   * saying which preference was given up.
   */
  const filters: { name: string; apply: (p: PlayerRow) => boolean }[] = [];
  if (options.maxNextDifficulty !== undefined) {
    const max = options.maxNextDifficulty;
    filters.push({
      name: `next fixture at most FDR ${max}`,
      apply: (p) => (p.fixtures[0]?.difficulty ?? 5) <= max,
    });
  }
  if (options.minStartProb !== undefined) {
    const min = options.minStartProb;
    filters.push({
      name: `${Math.round(min * 100)}%+ chance of starting`,
      apply: (p) => p.startProb >= min,
    });
  }
  if (options.fitOnly) {
    filters.push({ name: "fully fit only", apply: (p) => rowNewsLabel(p) === null });
  }

  const relaxed: string[] = [];
  let result: { squad: PlayerRow[]; score: number } | null = null;
  let pool = base;

  for (let dropped = 0; dropped <= filters.length; dropped++) {
    const active = filters.slice(dropped);
    pool = base.filter((p) => active.every((f) => f.apply(p)));

    const floors = priceFloors(pool);
    let best: PlayerRow[] | null = null;
    let bestScore = -Infinity;

    for (const lambda of [0, 0.1, 0.2, 0.3, 0.45, 0.6, 0.8, 1.1, 1.5, 2.2, 3.0]) {
      const squad = greedy(pool, lambda, opts, budget, locked, floors, rules);
      if (!squad) continue;
      const sc = objectiveOf(squad, opts);
      if (sc > bestScore) {
        bestScore = sc;
        best = squad;
      }
    }

    // On a tight budget every price penalty in the sweep can still overshoot and leave the
    // greedy unable to fill 15 slots. Falling back to the cheapest legal squad guarantees a
    // starting point whenever one exists at all, and the local search below improves it.
    if (!best) {
      const cheapest = cheapestLegal(pool, budget, locked, rules);
      if (cheapest) {
        best = cheapest;
        bestScore = objectiveOf(cheapest, opts);
      }
    }

    if (best) {
      result = { squad: best, score: bestScore };
      break;
    }
    if (dropped < filters.length) relaxed.push(filters[dropped].name);
  }

  if (!result) {
    return {
      squad: [],
      xi: bestXI([], key, formation, rules),
      cost: 0,
      objective: 0,
      iterations: 0,
      relaxed,
    };
  }

  // Steepest-ascent local search over single swaps.
  const lockedIds = new Set(locked.map((p) => p.id));
  let squad = result.squad;
  let current = result.score;
  let iterations = 0;

  for (let pass = 0; pass < 60; pass++) {
    let improvedThisPass = false;
    iterations++;

    for (let i = 0; i < squad.length; i++) {
      const out = squad[i];
      if (lockedIds.has(out.id)) continue;

      const squadIds = new Set(squad.map((p) => p.id));
      const spare = budget - squad.reduce((a, p) => a + p.cost, 0) + out.cost;
      const clubCount = squad.filter((p) => p.teamId === out.teamId).length;

      let bestSwap: { p: PlayerRow; s: number } | null = null;

      for (const cand of pool) {
        if (cand.posId !== out.posId) continue;
        if (squadIds.has(cand.id)) continue;
        if (cand.cost > spare + 1e-9) continue;
        if (cand.teamId !== out.teamId) {
          const count = squad.filter((p) => p.teamId === cand.teamId).length;
          if (count >= rules.teamLimit) continue;
        } else if (clubCount > rules.teamLimit) continue;

        const trial = squad.slice();
        trial[i] = cand;
        const s = objectiveOf(trial, opts);
        if (s > current + 1e-9 && (!bestSwap || s > bestSwap.s)) bestSwap = { p: cand, s };
      }

      if (bestSwap) {
        const next = squad.slice();
        next[i] = bestSwap.p;
        squad = next;
        current = bestSwap.s;
        improvedThisPass = true;
      }
    }

    if (!improvedThisPass) break;
  }

  return {
    squad,
    xi: bestXI(squad, key, formation, rules),
    cost: Math.round(squad.reduce((a, p) => a + p.cost, 0) * 10) / 10,
    objective: Math.round(current * 100) / 100,
    iterations,
    relaxed,
  };
}

export interface TransferSuggestion {
  out: PlayerRow;
  in: PlayerRow;
  gain: number;
  cost: number;
}

export interface TransferPlan {
  moves: TransferSuggestion[];
  gain: number;
  hitCost: number;
  netGain: number;
  squad: PlayerRow[];
  xi: XI;
}

/**
 * Evaluate 0–3 transfers against the current squad, charging 4 points for every move beyond
 * the free ones, and return the plan for each transfer count.
 */
export function planTransfers(
  squad: PlayerRow[],
  pool: PlayerRow[],
  {
    bank,
    freeTransfers,
    maxTransfers = 3,
    key = "xPts",
    benchWeight = 0.12,
    rules = DEFAULT_RULES,
  }: {
    bank: number;
    freeTransfers: number;
    maxTransfers?: number;
    key?: keyof PlayerRow;
    benchWeight?: number;
    rules?: SquadRules;
  },
): TransferPlan[] {
  const opts = { key, benchWeight, includeCaptain: false, penaltyBonus: 0, rules };
  const plans: TransferPlan[] = [];

  let currentSquad = squad.slice();
  let currentBank = bank;
  let baseline = objectiveOf(currentSquad, opts);
  const moves: TransferSuggestion[] = [];
  const originalBaseline = baseline;

  for (let t = 1; t <= maxTransfers; t++) {
    let bestMove: { i: number; cand: PlayerRow; s: number } | null = null;
    const squadIds = new Set(currentSquad.map((p) => p.id));

    for (let i = 0; i < currentSquad.length; i++) {
      const out = currentSquad[i];
      const funds = currentBank + out.cost;
      const clubCounts = new Map<number, number>();
      for (const p of currentSquad) {
        if (p.id === out.id) continue;
        clubCounts.set(p.teamId, (clubCounts.get(p.teamId) ?? 0) + 1);
      }

      for (const cand of pool) {
        if (cand.posId !== out.posId) continue;
        if (squadIds.has(cand.id)) continue;
        if (cand.cost > funds + 1e-9) continue;
        if ((clubCounts.get(cand.teamId) ?? 0) >= rules.teamLimit) continue;
        if (cand.status === "u" || cand.status === "n") continue;

        const trial = currentSquad.slice();
        trial[i] = cand;
        const s = objectiveOf(trial, opts);
        if (!bestMove || s > bestMove.s) bestMove = { i, cand, s };
      }
    }

    if (!bestMove || bestMove.s <= baseline + 1e-6) break;

    const out = currentSquad[bestMove.i];
    const next = currentSquad.slice();
    next[bestMove.i] = bestMove.cand;
    currentBank = currentBank + out.cost - bestMove.cand.cost;
    moves.push({
      out,
      in: bestMove.cand,
      gain: Math.round((bestMove.s - baseline) * 100) / 100,
      cost: Math.round((bestMove.cand.cost - out.cost) * 10) / 10,
    });
    currentSquad = next;
    baseline = bestMove.s;

    const hitCost = Math.max(0, t - freeTransfers) * 4;
    const gain = Math.round((baseline - originalBaseline) * 100) / 100;
    plans.push({
      moves: moves.slice(),
      gain,
      hitCost,
      netGain: Math.round((gain - hitCost) * 100) / 100,
      squad: currentSquad.slice(),
      xi: bestXI(currentSquad, key, undefined, rules),
    });
  }

  return plans;
}
