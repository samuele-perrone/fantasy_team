import type { Bootstrap, FplElement, FplFixture } from "./types";
import { availabilityFor } from "./news";
import {
  attackingMultiplier,
  clamp,
  cleanSheetProbability,
  deriveTeamRatings,
  expectedGoals,
  poissonAtLeast,
  type TeamRating,
} from "./ratings";

export const POS = { GKP: 1, DEF: 2, MID: 3, FWD: 4 } as const;

const GOAL_POINTS: Record<number, number> = { 1: 10, 2: 6, 3: 5, 4: 4 };
const CS_POINTS: Record<number, number> = { 1: 4, 2: 4, 3: 1, 4: 0 };
/** Defensive-contribution threshold: 10 CBIT for defenders, 12 CBIRT for everyone else. */
const DC_THRESHOLD: Record<number, number> = { 1: 99, 2: 10, 3: 12, 4: 12 };

export interface FixtureProjection {
  event: number;
  fixtureId: number;
  opponent: number;
  isHome: boolean;
  difficulty: number;
  points: number;
  minutes: number;
  cleanSheetProb: number;
  goalProb: number;
  assistProb: number;
  returnProb: number;
}

export interface PlayerProjection {
  id: number;
  /** expected points for the next single gameweek */
  next: number;
  /** expected points summed over the requested horizon */
  horizon: number;
  /** per-90 expected points, fixture-neutral */
  per90: number;
  /** expected minutes next gameweek */
  minutes: number;
  startProb: number;
  fixtures: FixtureProjection[];
  /** points per million over the horizon */
  value: number;
  /** 0–10 composite score blending projection, value and security of minutes */
  rating: number;
}

interface MinutesModel {
  startProb: number;
  playProb: number;
  p60: number;
  expected: number;
}

/**
 * Minutes are the single biggest driver of FPL points, so the sample rate is shrunk
 * toward a price-based prior — a £13m forward with no data is far more likely nailed
 * than a £4.0m one.
 */
function minutesModel(p: FplElement, teamGames: number): MinutesModel {
  // Availability is applied per fixture rather than here, since news changes what a player
  // is worth in gameweek one without saying anything about gameweek five.
  // Pre-season the carried-over stats still describe a full 38-game campaign.
  const sample = teamGames > 0 ? teamGames : p.minutes > 0 ? 38 : 0;

  const pricePrior = clamp((p.now_cost - 40) / 60, 0, 1);
  const prior = 0.15 + 0.6 * pricePrior;

  let startProb = prior;
  let subProb = 0.25;

  if (sample > 0) {
    const observedStarts = clamp(p.starts / sample, 0, 1);
    const appearances = clamp(p.minutes / (sample * 72), 0, 1);

    // Minutes belong to whichever club the player was at when they played them. A summer
    // signing carries a full season of starts from somewhere else, and reading those as a
    // guaranteed place in the new side is how a squad player ends up modelled as nailed.
    // Their history still says they are a good footballer, which price already reflects, so
    // the shrinkage moves them toward the price prior rather than penalising them outright.
    const daysAtClub = p.team_join_date
      ? (Date.now() - Date.parse(p.team_join_date)) / 86_400_000
      : Infinity;
    const newness = Number.isFinite(daysAtClub) ? clamp(1 - daysAtClub / 150, 0, 1) : 0;

    const w = sample / (sample + 5 + 22 * newness);
    startProb = observedStarts * w + prior * (1 - w);
    subProb = clamp(appearances - observedStarts, 0, 1) / Math.max(1 - observedStarts, 0.15);
    subProb = clamp(subProb, 0, 0.9);
  }

  startProb = clamp(startProb, 0, 0.97);
  const cameo = (1 - startProb) * subProb;
  const playProb = clamp(startProb + cameo, 0, 1);
  // Starters are pulled off or booked out of a 60+ appearance a fraction of the time.
  const p60 = startProb * 0.86;
  const expected = startProb * 81 + cameo * 19;

  return { startProb, playProb, p60, expected };
}

/** Expected bonus points per appearance, fitted against last season's bps-to-bonus curve. */
function expectedBonus(p: FplElement, minutesShare: number): number {
  const per90 = p.minutes > 0 ? (p.bps / p.minutes) * 90 : 0;
  return clamp((per90 - 14) * 0.085, 0, 2.2) * minutesShare;
}

function per90(value: string | number, minutes: number): number {
  const v = typeof value === "string" ? parseFloat(value) : value;
  if (!minutes || !Number.isFinite(v)) return 0;
  return (v / minutes) * 90;
}

export interface ProjectionContext {
  ratings: Map<number, TeamRating>;
  fixturesByTeam: Map<number, FplFixture[]>;
  teamGames: Map<number, number>;
  currentEvent: number;
  nextEvent: number;
}

export function buildContext(bootstrap: Bootstrap, fixtures: FplFixture[]): ProjectionContext {
  const ratings = deriveTeamRatings(bootstrap.teams, fixtures);
  const fixturesByTeam = new Map<number, FplFixture[]>();
  const teamGames = new Map<number, number>();

  for (const t of bootstrap.teams) {
    fixturesByTeam.set(t.id, []);
    teamGames.set(t.id, 0);
  }
  for (const f of fixtures) {
    fixturesByTeam.get(f.team_h)?.push(f);
    fixturesByTeam.get(f.team_a)?.push(f);
    if (f.finished) {
      teamGames.set(f.team_h, (teamGames.get(f.team_h) ?? 0) + 1);
      teamGames.set(f.team_a, (teamGames.get(f.team_a) ?? 0) + 1);
    }
  }
  for (const list of fixturesByTeam.values()) {
    list.sort((a, b) => (a.event ?? 99) - (b.event ?? 99));
  }

  const current = bootstrap.events.find((e) => e.is_current);
  const next = bootstrap.events.find((e) => e.is_next);
  return {
    ratings,
    fixturesByTeam,
    teamGames,
    currentEvent: current?.id ?? (next ? next.id - 1 : 1),
    nextEvent: next?.id ?? current?.id ?? 1,
  };
}

/** Project a single player against a single fixture. */
function projectFixture(
  p: FplElement,
  fixture: FplFixture,
  ctx: ProjectionContext,
  baseMins: MinutesModel,
): FixtureProjection {
  // News is read per fixture: a knock costs the next match, an "expected back" date rules
  // out only the fixtures before it.
  const avail = availabilityFor(
    p,
    fixture.kickoff_time,
    Math.max(0, (fixture.event ?? ctx.nextEvent) - ctx.nextEvent),
  );
  const mins: MinutesModel = {
    startProb: baseMins.startProb * avail,
    playProb: baseMins.playProb * avail,
    p60: baseMins.p60 * avail,
    expected: baseMins.expected * avail,
  };

  const isHome = fixture.team_h === p.team;
  const opponentId = isHome ? fixture.team_a : fixture.team_h;
  const team = ctx.ratings.get(p.team)!;
  const opponent = ctx.ratings.get(opponentId)!;
  const difficulty = isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty;

  const share = mins.expected / 90;
  const attack = attackingMultiplier(team, opponent, isHome);
  const csProb = cleanSheetProbability(team, opponent, isHome);
  const conceded = expectedGoals(opponent, team, !isHome);

  const xg = per90(p.expected_goals, p.minutes) || p.expected_goals_per_90 || 0;
  const xa = per90(p.expected_assists, p.minutes) || p.expected_assists_per_90 || 0;

  // Penalty takers convert at a premium the raw xG already partly reflects; nudge first takers up.
  const penBoost = p.penalties_order === 1 ? 1.12 : 1;

  const goals = xg * attack * share * penBoost;
  const assists = xa * attack * share;

  let points = 0;
  points += mins.p60 * 2 + (mins.playProb - mins.p60) * 1;
  points += goals * GOAL_POINTS[p.element_type];
  points += assists * 3;
  points += mins.p60 * csProb * CS_POINTS[p.element_type];

  if (p.element_type === POS.GKP || p.element_type === POS.DEF) {
    // -1 per two goals conceded while on the pitch
    points -= Math.max(0, conceded * share - 0.4) / 2;
  }
  if (p.element_type === POS.GKP) {
    const saves90 = p.saves_per_90 || per90(p.saves, p.minutes);
    points += (saves90 * share * (conceded / 1.4)) / 3;
    points += (p.minutes > 0 ? (p.penalties_saved / p.minutes) * 90 : 0) * share * 5;
  }

  const dc90 = p.defensive_contribution_per_90 || per90(p.defensive_contribution, p.minutes);
  const threshold = DC_THRESHOLD[p.element_type];
  if (threshold < 99 && dc90 > 0) {
    points += poissonAtLeast(dc90 * share, threshold) * 2 * mins.playProb;
  }

  points += expectedBonus(p, share);
  const cards90 = per90(p.yellow_cards, p.minutes) + per90(p.red_cards, p.minutes) * 3;
  points -= cards90 * share;

  const goalProb = 1 - Math.exp(-goals);
  const assistProb = 1 - Math.exp(-assists);

  return {
    event: fixture.event ?? 0,
    fixtureId: fixture.id,
    opponent: opponentId,
    isHome,
    difficulty,
    points: Math.max(points, 0),
    minutes: mins.expected,
    cleanSheetProb: csProb,
    goalProb,
    assistProb,
    returnProb: 1 - (1 - goalProb) * (1 - assistProb),
  };
}

/** Upcoming (unfinished) fixtures for a team, limited to `horizon` gameweeks. */
export function upcomingFixtures(
  teamId: number,
  ctx: ProjectionContext,
  horizon: number,
  fromEvent = ctx.nextEvent,
): FplFixture[] {
  const all = ctx.fixturesByTeam.get(teamId) ?? [];
  return all.filter(
    (f) => f.event !== null && f.event >= fromEvent && f.event < fromEvent + horizon && !f.finished,
  );
}

export function projectPlayer(
  p: FplElement,
  ctx: ProjectionContext,
  horizon = 5,
): PlayerProjection {
  const mins = minutesModel(p, ctx.teamGames.get(p.team) ?? 0);
  const fixtures = upcomingFixtures(p.team, ctx, horizon).map((f) =>
    projectFixture(p, f, ctx, mins),
  );

  const nextEventFixtures = fixtures.filter((f) => f.event === ctx.nextEvent);
  const next = nextEventFixtures.reduce((a, f) => a + f.points, 0);
  const total = fixtures.reduce((a, f) => a + f.points, 0);
  const cost = p.now_cost / 10;
  const value = cost > 0 ? total / cost : 0;

  const perGame = fixtures.length ? total / fixtures.length : 0;
  const neutral90 = mins.expected > 0 ? (perGame / mins.expected) * 90 : 0;

  // Reported minutes reflect the next gameweek specifically, so a flagged player shows the
  // reduced figure the news implies rather than their fully fit baseline.
  const nextMinutes = nextEventFixtures.length
    ? nextEventFixtures.reduce((a, f) => a + f.minutes, 0)
    : 0;
  const nextAvailability = mins.expected > 0 ? nextMinutes / mins.expected : 0;
  const nextStartProb = clamp(mins.startProb * Math.min(nextAvailability, 1), 0, 1);

  // Rating blends raw output, value for money and minutes security onto a 0–10 scale.
  const rating = clamp(perGame * 1.05 + value * 0.32 + nextStartProb * 1.6, 0, 10);

  return {
    id: p.id,
    next,
    horizon: total,
    per90: neutral90,
    minutes: nextMinutes,
    startProb: nextStartProb,
    fixtures,
    value,
    rating,
  };
}

export function projectAll(
  bootstrap: Bootstrap,
  ctx: ProjectionContext,
  horizon = 5,
): Map<number, PlayerProjection> {
  const out = new Map<number, PlayerProjection>();
  for (const p of bootstrap.elements) {
    out.set(p.id, projectPlayer(p, ctx, horizon));
  }
  return out;
}
