import type { PlayerRow } from "./data";

export const SQUAD_QUOTA: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 };
export const TEAM_LIMIT = 3;

/** Every legal outfield shape: 1 GK plus 10 outfielders within FPL's positional minimums. */
export const FORMATIONS: [number, number, number][] = [];
for (let d = 3; d <= 5; d++) {
  for (let m = 2; m <= 5; m++) {
    const f = 10 - d - m;
    if (f >= 1 && f <= 3) FORMATIONS.push([d, m, f]);
  }
}

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

/** Pick the highest-scoring legal XI out of a 15-man squad. */
export function bestXI(squad: PlayerRow[], key: keyof PlayerRow = "xPtsNext"): XI {
  const byPos = (pos: number) =>
    squad.filter((p) => p.posId === pos).sort((a, b) => score(b, key) - score(a, key));

  const gks = byPos(1);
  const defs = byPos(2);
  const mids = byPos(3);
  const fwds = byPos(4);

  let best: XI | null = null;

  for (const [d, m, f] of FORMATIONS) {
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
}

export interface OptimiseResult {
  squad: PlayerRow[];
  xi: XI;
  cost: number;
  objective: number;
  iterations: number;
}

interface State {
  squad: PlayerRow[];
  cost: number;
  counts: Record<number, number>;
  clubs: Map<number, number>;
}

function objectiveOf(squad: PlayerRow[], opts: Required<Pick<OptimiseOptions, "key" | "benchWeight" | "includeCaptain">>) {
  const xi = bestXI(squad, opts.key);
  const captainBonus = opts.includeCaptain && xi.captain ? score(xi.captain, opts.key) : 0;
  return xi.startingPoints + captainBonus + xi.benchPoints * opts.benchWeight;
}

function canAdd(state: State, p: PlayerRow, budget: number, remainingSlots: number): boolean {
  if (state.counts[p.posId] >= SQUAD_QUOTA[p.posId]) return false;
  if ((state.clubs.get(p.teamId) ?? 0) >= TEAM_LIMIT) return false;
  // leave enough money for the cheapest possible fill of the remaining slots
  const reserve = (remainingSlots - 1) * 4.0;
  return state.cost + p.cost + reserve <= budget + 1e-9;
}

function greedy(
  pool: PlayerRow[],
  lambda: number,
  opts: Required<Pick<OptimiseOptions, "key">>,
  budget: number,
  locked: PlayerRow[],
): PlayerRow[] | null {
  const state: State = { squad: [], cost: 0, counts: { 1: 0, 2: 0, 3: 0, 4: 0 }, clubs: new Map() };

  const push = (p: PlayerRow) => {
    state.squad.push(p);
    state.cost += p.cost;
    state.counts[p.posId]++;
    state.clubs.set(p.teamId, (state.clubs.get(p.teamId) ?? 0) + 1);
  };

  for (const p of locked) {
    if (state.counts[p.posId] >= SQUAD_QUOTA[p.posId]) continue;
    if ((state.clubs.get(p.teamId) ?? 0) >= TEAM_LIMIT) continue;
    push(p);
  }
  if (state.cost > budget) return null;

  const lockedIds = new Set(locked.map((p) => p.id));
  const ranked = pool
    .filter((p) => !lockedIds.has(p.id))
    .map((p) => ({ p, v: score(p, opts.key) - lambda * p.cost }))
    .sort((a, b) => b.v - a.v);

  for (const { p } of ranked) {
    if (state.squad.length === 15) break;
    if (canAdd(state, p, budget, 15 - state.squad.length)) push(p);
  }

  return state.squad.length === 15 ? state.squad : null;
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
  const opts = { key, benchWeight, includeCaptain };
  const budget = options.budget;

  const banned = new Set(options.banned ?? []);
  const pool = players.filter(
    (p) => !banned.has(p.id) && p.status !== "u" && p.status !== "n" && p.cost <= budget,
  );
  const byId = new Map(players.map((p) => [p.id, p]));
  const locked = (options.locked ?? [])
    .map((id) => byId.get(id))
    .filter((p): p is PlayerRow => Boolean(p))
    .slice(0, 15);

  let best: PlayerRow[] | null = null;
  let bestScore = -Infinity;

  for (const lambda of [0, 0.1, 0.2, 0.3, 0.45, 0.6, 0.8, 1.1, 1.5, 2.2, 3.0]) {
    const squad = greedy(pool, lambda, opts, budget, locked);
    if (!squad) continue;
    const s = objectiveOf(squad, opts);
    if (s > bestScore) {
      bestScore = s;
      best = squad;
    }
  }

  if (!best) {
    return {
      squad: [],
      xi: bestXI([], key),
      cost: 0,
      objective: 0,
      iterations: 0,
    };
  }

  // Steepest-ascent local search over single swaps.
  const lockedIds = new Set(locked.map((p) => p.id));
  let squad = best;
  let current = bestScore;
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
          if (count >= TEAM_LIMIT) continue;
        } else if (clubCount > TEAM_LIMIT) continue;

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
    xi: bestXI(squad, key),
    cost: Math.round(squad.reduce((a, p) => a + p.cost, 0) * 10) / 10,
    objective: Math.round(current * 100) / 100,
    iterations,
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
  }: {
    bank: number;
    freeTransfers: number;
    maxTransfers?: number;
    key?: keyof PlayerRow;
    benchWeight?: number;
  },
): TransferPlan[] {
  const opts = { key, benchWeight, includeCaptain: false };
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
        if ((clubCounts.get(cand.teamId) ?? 0) >= TEAM_LIMIT) continue;
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
      xi: bestXI(currentSquad, key),
    });
  }

  return plans;
}
