import type { PlayerRow } from "./row";
import { rowNewsLabel } from "./news";
import { DEFAULT_RULES, type SquadRules } from "./rules";

/**
 * Keep / watch / sell for every squad player, plus the transfer suggestions that go with them.
 *
 * Every verdict is a comparison with the best replacement the manager can afford in the same
 * position, so a Sell and the replacements offered under it always come from one calculation.
 * Thresholds are starting values, not fitted ones — see docs/PLAN.md and docs/DECISIONS.md.
 */
export const VERDICT_RULES = {
  /** gameweeks compared; matches the transfer planner's horizon */
  horizon: 5,
  /** nearer gameweeks count more: team news and form are only reliable a week or two out */
  weights: [1, 0.9, 0.8, 0.7, 0.6],
  /**
   * Weighted points a replacement must gain to call a Sell. The model is off by about 1.6
   * points per player per gameweek, so a smaller gap over five weeks is not clearly real.
   */
  sellGap: 5,
  watchGap: 2,
  /**
   * A Sell beyond the free transfers costs 4 points, and the existing hit rule asks it to
   * clear the hit by another 4 — see "Hits need a margin" in docs/DECISIONS.md.
   */
  hitGap: 8,
  /** Sells allowed beyond the free transfers; each one costs a 4-point hit */
  maxHits: 1,
} as const;

export type Verdict = "keep" | "watch" | "sell";

export interface Replacement {
  player: PlayerRow;
  /** weighted points gained over the horizon by making the swap */
  gain: number;
  reason: string;
}

export interface PlayerVerdict {
  player: PlayerRow;
  verdict: Verdict;
  reason: string;
  /** weighted points over the horizon */
  score: number;
  /** what the best affordable replacement gains, 0 when none is better */
  gap: number;
  /** consecutive upcoming gameweeks the player is expected to miss */
  outGameweeks: number;
  /** best three affordable replacements, best first; empty when none is better */
  replacements: Replacement[];
  /** a Sell made beyond the free transfers, so it costs a 4-point hit */
  needsHit: boolean;
}

export interface Suggestion {
  player: PlayerRow;
  /** the squad player this one would replace */
  replaces: PlayerRow;
  gain: number;
  reason: string;
}

export interface VerdictInput {
  squad: PlayerRow[];
  pool: PlayerRow[];
  bank: number;
  freeTransfers: number;
  /** the gameweek the comparison starts from, i.e. the next deadline */
  nextEvent: number;
  rules?: SquadRules;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Weighted expected points over the horizon. A blank gameweek simply contributes nothing. */
export function weightedScore(p: PlayerRow, nextEvent: number): number {
  let total = 0;
  for (const f of p.fixtures) {
    const w = VERDICT_RULES.weights[f.event - nextEvent];
    if (w !== undefined) total += f.xPts * w;
  }
  return total;
}

/**
 * Gameweeks in a row, starting with the next one, in which the player is expected to play no
 * minutes. A gameweek with no fixture at all is skipped rather than counted: a blank is the
 * club's schedule, not the player being unavailable.
 */
export function outGameweeks(p: PlayerRow, nextEvent: number): number {
  let out = 0;
  for (let e = nextEvent; e < nextEvent + VERDICT_RULES.horizon; e++) {
    const games = p.fixtures.filter((f) => f.event === e);
    if (!games.length) continue;
    if (games.every((f) => f.xMins < 1)) out++;
    else break;
  }
  return out;
}

const unavailable = (p: PlayerRow) => p.status === "u" || p.status === "n";

/** Players who could replace `out` without breaking the budget or the club limit. */
function affordable(
  out: PlayerRow,
  squad: PlayerRow[],
  pool: PlayerRow[],
  bank: number,
  rules: SquadRules,
): PlayerRow[] {
  const owned = new Set(squad.map((p) => p.id));
  const clubs = new Map<number, number>();
  for (const p of squad) {
    if (p.id !== out.id) clubs.set(p.teamId, (clubs.get(p.teamId) ?? 0) + 1);
  }
  // Funds use today's price. FPL's public endpoints do not expose the selling price, which
  // can be lower after a price rise (half the profit is kept), so this can slightly
  // overstate the budget for a player who has risen since being bought.
  const funds = out.cost + bank + 1e-9;
  return pool.filter(
    (c) =>
      c.posId === out.posId &&
      !owned.has(c.id) &&
      !unavailable(c) &&
      c.cost <= funds &&
      (clubs.get(c.teamId) ?? 0) < rules.teamLimit,
  );
}

function fixtureList(p: PlayerRow, n = 3): string {
  return p.fixtures
    .slice(0, n)
    .map((f) => `${f.opponent} (${f.isHome ? "h" : "a"})`)
    .join(", ");
}

function averageDifficulty(p: PlayerRow, n = 3): number | null {
  const next = p.fixtures.slice(0, n);
  return next.length ? next.reduce((a, f) => a + f.difficulty, 0) / next.length : null;
}

/** Why a player is out, in a few words — FPL's news is often a sentence long. */
function outReason(p: PlayerRow, gameweeks: number): string {
  const label = rowNewsLabel(p);
  if (label?.startsWith("back ")) return `Out until ${label.slice(5)}`;
  if (label === "suspended") return gameweeks > 1 ? "Suspended" : "Suspended for the next game";
  if (gameweeks === 1) return "Expected to miss the next game";
  return p.news ? shortNews(p.news) : "Not expected to play for a while";
}

function shortNews(news: string): string {
  const trimmed = news.trim().replace(/\.$/, "");
  return trimmed.length > 70 ? `${trimmed.slice(0, 67)}…` : trimmed;
}

/** One sentence on why a buy is worth it, leading with the most concrete factor. */
function buyReason(p: PlayerRow): string {
  const diff = averageDifficulty(p);
  if (p.penaltyOrder === 1 && diff !== null && diff <= 2.7) {
    return `On penalties, good run: ${fixtureList(p)}`;
  }
  if (diff !== null && diff <= 2.5) return `Good run: ${fixtureList(p)}`;
  if (p.form >= 6) return `In form, ${p.form.toFixed(1)} points a game lately`;
  if (p.penaltyOrder === 1) return "On penalties";
  if (p.startProb >= 0.85) return "Starts every week";
  return `Next: ${fixtureList(p)}`;
}

function rankReplacements(
  out: PlayerRow,
  squad: PlayerRow[],
  pool: PlayerRow[],
  bank: number,
  rules: SquadRules,
  score: (p: PlayerRow) => number,
  taken: Set<number> = new Set(),
): Replacement[] {
  const own = score(out);
  return affordable(out, squad, pool, bank, rules)
    .filter((c) => !taken.has(c.id))
    .map((c) => ({ player: c, gain: score(c) - own }))
    // Under a point over five gameweeks is noise, and "about 0 more points" is no reason to buy.
    .filter((r) => r.gain >= 1)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 3)
    .map((r) => ({ ...r, gain: round1(r.gain), reason: buyReason(r.player) }));
}

function sellReason(p: PlayerRow, out: number, best: PlayerRow | undefined, gap: number): string {
  if (out >= 1) return outReason(p, out);
  const diff = averageDifficulty(p);
  if (diff !== null && diff >= 3.7) return `Tough run: ${fixtureList(p)}`;
  if (p.startProb < 0.6) return "Not starting regularly";
  return best
    ? `${best.name} should score about ${Math.round(gap)} more over five gameweeks`
    : "Better options available";
}

export function computeVerdicts(input: VerdictInput): PlayerVerdict[] {
  const rules = input.rules ?? DEFAULT_RULES;
  const { squad, pool, bank, nextEvent } = input;
  const scoreOf = new Map(pool.map((p) => [p.id, weightedScore(p, nextEvent)]));
  for (const p of squad) if (!scoreOf.has(p.id)) scoreOf.set(p.id, weightedScore(p, nextEvent));
  const score = (p: PlayerRow) => scoreOf.get(p.id) ?? 0;

  const verdicts: PlayerVerdict[] = squad.map((p) => {
    const replacements = rankReplacements(p, squad, pool, bank, rules, score);
    const gap = replacements[0]?.gain ?? 0;
    const out = outGameweeks(p, nextEvent);
    const best = replacements[0]?.player;
    const base = {
      player: p,
      score: round1(score(p)),
      gap,
      outGameweeks: out,
      replacements,
      needsHit: false,
    };

    if (out >= 2 || (gap >= VERDICT_RULES.sellGap && best)) {
      return { ...base, verdict: "sell", reason: sellReason(p, out, best, gap) };
    }

    if (out === 1) return { ...base, verdict: "watch", reason: outReason(p, out) };

    // A published chance below 100 that has not ruled the player out is a doubt to keep an
    // eye on. FPL grades these 75/50/25, and 0 is already covered by `out` above.
    if (p.availability !== null && p.availability < 100) {
      return {
        ...base,
        verdict: "watch",
        reason: p.news ? shortNews(p.news) : `${p.availability}% chance of playing`,
      };
    }

    if (gap >= VERDICT_RULES.watchGap && best) {
      return {
        ...base,
        verdict: "watch",
        reason: `${best.name} is slightly better over the next five gameweeks`,
      };
    }

    const diff = averageDifficulty(p);
    const reason = !p.fixtures.some((f) => f.event === nextEvent)
      ? "No game this gameweek"
      : diff !== null && diff <= 2.5
        ? `Good run: ${fixtureList(p)}`
        : p.startProb >= 0.85 && gap === 0
          ? "Starts every week, nobody better you can afford"
          : "No clearly better option you can afford";
    return { ...base, verdict: "keep", reason };
  });

  // Sells are settled as one plan, not fifteen separate opinions. Each one is made in turn on
  // a working copy of the squad, so a replacement cannot be offered twice and the club limit
  // counts players already brought in.
  //
  // Free transfers go to the players ruled out longest, then the biggest gains. After those,
  // at most one more Sell is allowed, and only if it beats the hit rule; anything else waits
  // as a Watch. A screen that says "sell four" to a manager with one free transfer is not
  // advice anyone can follow.
  const sells = verdicts
    .filter((v) => v.verdict === "sell")
    .sort((a, b) => b.outGameweeks - a.outGameweeks || b.gap - a.gap);
  const free = Math.max(input.freeTransfers, 0);
  let working = squad.slice();
  let funds = bank;
  const taken = new Set<number>();
  let made = 0;

  for (const v of sells) {
    const options = rankReplacements(v.player, working, pool, funds, rules, score, taken);
    const top = options[0];
    const gain = top?.gain ?? 0;
    const allowed =
      made < free
        ? v.outGameweeks >= 2 || gain >= VERDICT_RULES.sellGap
        : made < free + VERDICT_RULES.maxHits && gain >= VERDICT_RULES.hitGap;

    v.replacements = options;
    v.gap = gain;
    const reason = sellReason(v.player, v.outGameweeks, top?.player, gain);

    if (!allowed) {
      v.verdict = "watch";
      v.reason = `${reason}. Other transfers come first`;
      continue;
    }

    v.reason = reason;
    v.needsHit = made >= free;
    made++;
    if (top) {
      taken.add(top.player.id);
      working = working.map((p) => (p.id === v.player.id ? top.player : p));
      // Money freed by one sale is never spent on the next. Every option shown has to be
      // affordable whether the manager makes that move alone or all of them, so the bank can
      // only go down here.
      funds = Math.min(funds, funds + v.player.cost - top.player.cost);
    }
  }

  return verdicts;
}

/**
 * The squad player a candidate would best replace, and what the swap gains. Null when the
 * candidate is not affordable for anyone in that position.
 */
export function bestSwapFor(
  candidate: PlayerRow,
  input: VerdictInput,
): { replaces: PlayerRow; gain: number } | null {
  const rules = input.rules ?? DEFAULT_RULES;
  let best: { replaces: PlayerRow; gain: number } | null = null;
  const cs = weightedScore(candidate, input.nextEvent);
  for (const out of input.squad) {
    if (out.posId !== candidate.posId) continue;
    const ok = affordable(out, input.squad, [candidate], input.bank, rules).length > 0;
    if (!ok) continue;
    const gain = cs - weightedScore(out, input.nextEvent);
    if (!best || gain > best.gain) best = { replaces: out, gain };
  }
  return best && { ...best, gain: round1(best.gain) };
}

/**
 * The best buys this week across every position, whether or not anyone is marked Sell. At most
 * two suggestions replace the same squad player, so one weak bench slot cannot fill the list.
 */
export function suggestTransfers(input: VerdictInput, limit = 5): Suggestion[] {
  const owned = new Set(input.squad.map((p) => p.id));
  const candidates = input.pool
    .filter((p) => !owned.has(p.id) && !unavailable(p) && outGameweeks(p, input.nextEvent) === 0)
    .map((p) => ({ player: p, swap: bestSwapFor(p, input) }))
    .filter(
      (c): c is { player: PlayerRow; swap: { replaces: PlayerRow; gain: number } } =>
        c.swap !== null && c.swap.gain >= VERDICT_RULES.watchGap,
    )
    .sort((a, b) => b.swap.gain - a.swap.gain);

  const perTarget = new Map<number, number>();
  const out: Suggestion[] = [];
  for (const c of candidates) {
    const used = perTarget.get(c.swap.replaces.id) ?? 0;
    if (used >= 2) continue;
    perTarget.set(c.swap.replaces.id, used + 1);
    out.push({
      player: c.player,
      replaces: c.swap.replaces,
      gain: c.swap.gain,
      reason: buyReason(c.player),
    });
    if (out.length >= limit) break;
  }
  return out;
}
