import type { Bootstrap } from "./types";

/**
 * Squad rules, read from FPL rather than assumed.
 *
 * These were hardcoded in several places, which quietly bet on the rules never changing.
 * They do: recent seasons added the defensive contribution point, the Assistant Manager chip
 * and a five-transfer rollover cap. Reading them means a rule change shows up as different
 * behaviour rather than as an optimiser confidently building an illegal squad.
 *
 * The fallbacks are the 2026/27 values, used only if FPL omits a field.
 */
export interface SquadRules {
  /** players per position, keyed by element_type */
  quota: Record<number, number>;
  /** minimum that must start, keyed by element_type */
  minPlay: Record<number, number>;
  maxPlay: Record<number, number>;
  squadSize: number;
  startingSize: number;
  teamLimit: number;
  /** budget in £m */
  budget: number;
  sellOnFee: number;
  maxRollover: number;
}

export const DEFAULT_RULES: SquadRules = {
  quota: { 1: 2, 2: 5, 3: 5, 4: 3 },
  minPlay: { 1: 1, 2: 3, 3: 2, 4: 1 },
  maxPlay: { 1: 1, 2: 5, 3: 5, 4: 3 },
  squadSize: 15,
  startingSize: 11,
  teamLimit: 3,
  budget: 100,
  sellOnFee: 0.5,
  maxRollover: 5,
};

export function readRules(bootstrap: Bootstrap): SquadRules {
  const g = bootstrap.game_settings;
  const types = bootstrap.element_types ?? [];

  if (!g || !types.length) return DEFAULT_RULES;

  const quota: Record<number, number> = {};
  const minPlay: Record<number, number> = {};
  const maxPlay: Record<number, number> = {};
  for (const t of types) {
    quota[t.id] = t.squad_select;
    minPlay[t.id] = t.squad_min_play;
    maxPlay[t.id] = t.squad_max_play;
  }

  return {
    quota: Object.keys(quota).length ? quota : DEFAULT_RULES.quota,
    minPlay: Object.keys(minPlay).length ? minPlay : DEFAULT_RULES.minPlay,
    maxPlay: Object.keys(maxPlay).length ? maxPlay : DEFAULT_RULES.maxPlay,
    squadSize: g.squad_squadsize ?? DEFAULT_RULES.squadSize,
    startingSize: g.squad_squadplay ?? DEFAULT_RULES.startingSize,
    teamLimit: g.squad_team_limit ?? DEFAULT_RULES.teamLimit,
    budget: (g.squad_total_spend ?? 1000) / 10,
    sellOnFee: g.transfers_sell_on_fee ?? DEFAULT_RULES.sellOnFee,
    maxRollover: (g.max_extra_free_transfers ?? 4) + 1,
  };
}

/** Every legal outfield shape under the given rules. */
export function formationsFor(rules: SquadRules): [number, number, number][] {
  const out: [number, number, number][] = [];
  const outfield = rules.startingSize - 1;

  for (let d = rules.minPlay[2]; d <= rules.maxPlay[2]; d++) {
    for (let m = rules.minPlay[3]; m <= rules.maxPlay[3]; m++) {
      const f = outfield - d - m;
      if (f >= rules.minPlay[4] && f <= rules.maxPlay[4]) out.push([d, m, f]);
    }
  }
  return out;
}

/** Human-readable summary, for surfacing what the app is currently enforcing. */
export function describeRules(rules: SquadRules): string {
  const q = [1, 2, 3, 4].map((p) => rules.quota[p]).join("/");
  return `${rules.squadSize} players (${q}), max ${rules.teamLimit} per club, £${rules.budget.toFixed(1)}m budget`;
}

/**
 * Flags any rule that differs from what the app was built against, so a mid-season change
 * is visible rather than silent.
 */
export function ruleDrift(rules: SquadRules): string[] {
  const drift: string[] = [];
  const d = DEFAULT_RULES;

  if (rules.squadSize !== d.squadSize) drift.push(`squad size ${d.squadSize} → ${rules.squadSize}`);
  if (rules.startingSize !== d.startingSize)
    drift.push(`starting XI ${d.startingSize} → ${rules.startingSize}`);
  if (rules.teamLimit !== d.teamLimit) drift.push(`per-club limit ${d.teamLimit} → ${rules.teamLimit}`);
  if (rules.budget !== d.budget) drift.push(`budget £${d.budget}m → £${rules.budget}m`);
  for (const pos of [1, 2, 3, 4]) {
    if (rules.quota[pos] !== d.quota[pos]) {
      drift.push(`position ${pos} quota ${d.quota[pos]} → ${rules.quota[pos]}`);
    }
  }
  return drift;
}
