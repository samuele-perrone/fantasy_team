import type { FplElement, FplEvent, FplFixture, FplTeam, LiveElement } from "./types";

/**
 * Premier League matches as the Matches tab shows them, built from FPL's fixtures and live
 * endpoints. Pure: the server module in `src/lib/app/matches.ts` does the fetching.
 */

export type MatchStatus = "upcoming" | "live" | "finished" | "postponed";

export interface MatchSide {
  id: number;
  name: string;
  short: string;
  code: number;
  score: number | null;
}

/** One line of a match report: a player and how many of something they did. */
export interface Incident {
  playerId: number;
  name: string;
  side: "h" | "a";
  value: number;
}

export interface MatchPlayer {
  id: number;
  name: string;
  side: "h" | "a";
  mine: boolean;
  watched: boolean;
  /** null before kickoff */
  points: number | null;
  minutes: number | null;
}

export interface Match {
  id: number;
  event: number;
  kickoff: string | null;
  status: MatchStatus;
  /** minutes played so far, as FPL reports it */
  minutes: number;
  home: MatchSide;
  away: MatchSide;
  goals: Incident[];
  assists: Incident[];
  ownGoals: Incident[];
  penaltiesSaved: Incident[];
  penaltiesMissed: Incident[];
  yellowCards: Incident[];
  redCards: Incident[];
  bonus: Incident[];
  /** bonus is worked out from the live BPS until FPL confirms it after the match */
  bonusProvisional: boolean;
  /** the manager's squad and watchlist players at either club, highlighted */
  players: MatchPlayer[];
}

export interface MatchContext {
  teams: Map<number, FplTeam>;
  elements: Map<number, FplElement>;
  /** per-player live stats for the gameweek; empty before any match has started */
  live: Map<number, LiveElement>;
  squadIds: Set<number>;
  watchIds: Set<number>;
}

export function matchStatus(f: FplFixture): MatchStatus {
  if (!f.kickoff_time) return "postponed";
  if (!f.started) return "upcoming";
  // `finished` flips long after the whistle, once bonus is confirmed; finished_provisional is
  // the full-time signal.
  return f.finished_provisional || f.finished ? "finished" : "live";
}

/**
 * FPL's bonus rule applied to BPS: 3, 2 and 1 for the top three, where tied players share the
 * higher rank and the next player drops by the number tied. Two level on top both get 3 and
 * the next gets 1; three level in third all get 1.
 */
export function provisionalBonus(
  bps: { element: number; value: number }[],
): { element: number; value: number }[] {
  return bps
    .map((b) => ({
      element: b.element,
      rank: 1 + bps.filter((o) => o.value > b.value).length,
    }))
    .filter((b) => b.rank <= 3)
    .map((b) => ({ element: b.element, value: 4 - b.rank }))
    .sort((a, b) => b.value - a.value);
}

function stat(f: FplFixture, identifier: string) {
  const s = f.stats.find((x) => x.identifier === identifier);
  return {
    h: s?.h ?? [],
    a: s?.a ?? [],
  };
}

function incidents(f: FplFixture, identifier: string, ctx: MatchContext): Incident[] {
  const { h, a } = stat(f, identifier);
  const out = [
    ...h.map((x) => ({ ...x, side: "h" as const })),
    ...a.map((x) => ({ ...x, side: "a" as const })),
  ];
  return out
    .filter((x) => x.value > 0)
    .map((x) => ({
      playerId: x.element,
      name: ctx.elements.get(x.element)?.web_name ?? "Unknown",
      side: x.side,
      value: x.value,
    }))
    .sort((x, y) => y.value - x.value);
}

function bonusFor(f: FplFixture, ctx: MatchContext): { list: Incident[]; provisional: boolean } {
  const confirmed = incidents(f, "bonus", ctx);
  if (confirmed.length || !f.started) return { list: confirmed, provisional: false };

  const { h, a } = stat(f, "bps");
  const sideOf = new Map<number, "h" | "a">([
    ...h.map((x) => [x.element, "h"] as const),
    ...a.map((x) => [x.element, "a"] as const),
  ]);
  const list = provisionalBonus([...h, ...a]).map((b) => ({
    playerId: b.element,
    name: ctx.elements.get(b.element)?.web_name ?? "Unknown",
    side: sideOf.get(b.element)!,
    value: b.value,
  }));
  return { list, provisional: list.length > 0 };
}

/**
 * A player's points in this one match. The live endpoint's `explain` splits a double
 * gameweek by fixture, so this stays right when a club plays twice. Bonus is taken from the
 * match rather than from `explain`, which only gains it once FPL confirms it.
 */
function pointsIn(live: LiveElement | undefined, fixtureId: number, bonus: number) {
  const entry = live?.explain.find((e) => e.fixture === fixtureId);
  if (!entry) return { points: bonus || 0, minutes: 0 };
  const points = entry.stats
    .filter((s) => s.identifier !== "bonus")
    .reduce((sum, s) => sum + s.points, 0);
  const minutes = entry.stats.find((s) => s.identifier === "minutes")?.value ?? 0;
  return { points: points + bonus, minutes };
}

function side(f: FplFixture, which: "h" | "a", teams: Map<number, FplTeam>): MatchSide {
  const id = which === "h" ? f.team_h : f.team_a;
  const t = teams.get(id);
  return {
    id,
    name: t?.name ?? "Unknown",
    short: t?.short_name ?? "???",
    code: t?.code ?? 0,
    score: f.started ? ((which === "h" ? f.team_h_score : f.team_a_score) ?? 0) : null,
  };
}

export function buildMatch(f: FplFixture, ctx: MatchContext): Match {
  const status = matchStatus(f);
  const bonus = bonusFor(f, ctx);
  const bonusById = new Map(bonus.list.map((b) => [b.playerId, b.value]));

  const players: MatchPlayer[] = [];
  for (const id of new Set([...ctx.squadIds, ...ctx.watchIds])) {
    const p = ctx.elements.get(id);
    if (!p || (p.team !== f.team_h && p.team !== f.team_a)) continue;
    const started = status === "live" || status === "finished";
    const result = started ? pointsIn(ctx.live.get(id), f.id, bonusById.get(id) ?? 0) : null;
    players.push({
      id,
      name: p.web_name,
      side: p.team === f.team_h ? "h" : "a",
      mine: ctx.squadIds.has(id),
      watched: ctx.watchIds.has(id),
      points: result?.points ?? null,
      minutes: result?.minutes ?? null,
    });
  }
  // Squad players first, then by points, so the manager's own interest leads.
  players.sort(
    (a, b) =>
      Number(b.mine) - Number(a.mine) ||
      (b.points ?? 0) - (a.points ?? 0) ||
      a.name.localeCompare(b.name),
  );

  return {
    id: f.id,
    event: f.event ?? 0,
    kickoff: f.kickoff_time,
    status,
    minutes: f.minutes,
    home: side(f, "h", ctx.teams),
    away: side(f, "a", ctx.teams),
    goals: incidents(f, "goals_scored", ctx),
    assists: incidents(f, "assists", ctx),
    ownGoals: incidents(f, "own_goals", ctx),
    penaltiesSaved: incidents(f, "penalties_saved", ctx),
    penaltiesMissed: incidents(f, "penalties_missed", ctx),
    yellowCards: incidents(f, "yellow_cards", ctx),
    redCards: incidents(f, "red_cards", ctx),
    bonus: bonus.list,
    bonusProvisional: bonus.provisional,
    players,
  };
}

/**
 * The gameweek the tab opens on: the current one while any of its matches are still to be
 * played, otherwise the next. Once a gameweek is over its results are one tap back, and the
 * fixtures a manager is planning around are what they see first.
 */
export function defaultEvent(events: FplEvent[]): number {
  const current = events.find((e) => e.is_current);
  const next = events.find((e) => e.is_next);
  if (current && !current.finished) return current.id;
  return next?.id ?? current?.id ?? events[0]?.id ?? 1;
}

/** London calendar day, the grouping a Premier League fan reads fixtures by. */
export function matchDay(iso: string | null): string {
  if (!iso) return "Date to be confirmed";
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  });
}

export interface MatchDayGroup {
  day: string;
  matches: Match[];
}

/** Matches in kickoff order, grouped by day, with unscheduled ones last. */
export function groupByDay(matches: Match[]): MatchDayGroup[] {
  const sorted = [...matches].sort(
    (a, b) =>
      (a.kickoff ? Date.parse(a.kickoff) : Infinity) -
        (b.kickoff ? Date.parse(b.kickoff) : Infinity) || a.id - b.id,
  );
  const groups: MatchDayGroup[] = [];
  for (const m of sorted) {
    const day = matchDay(m.kickoff);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.matches.push(m);
    else groups.push({ day, matches: [m] });
  }
  return groups;
}
