import type { FplElement, FplTeam } from "./types";
import type { PlayerProjection } from "./projection";
import type { TeamSchedule } from "./schedule";

export const POSITIONS = ["", "GKP", "DEF", "MID", "FWD"] as const;

export interface FixtureChip {
  event: number;
  opponent: string;
  opponentId: number;
  isHome: boolean;
  difficulty: number;
  xPts: number;
  /** expected minutes in this fixture, after availability — 0 means ruled out */
  xMins: number;
  kickoff: string | null;
  /** part of a run of three games in seven days, counting every competition */
  congested: boolean;
}

/** A match outside the Premier League, as the (i) panel and player page list it. */
export interface OtherGame {
  kickoff: string;
  competition: string;
  opponent: string;
  isHome: boolean;
}

/** Flat, client-serialisable player record used by every table in the app. */
export interface PlayerRow {
  id: number;
  code: number;
  name: string;
  fullName: string;
  team: string;
  teamId: number;
  teamName: string;
  pos: string;
  posId: number;
  cost: number;
  status: string;
  news: string;
  availability: number | null;
  /** days at the current club, or null when unknown */
  daysAtClub: number | null;
  /** link to the press conference or club statement behind the news, when FPL cites one */
  newsSource: string;
  /** when FPL last changed the news, ISO timestamp, or null */
  newsAdded: string | null;

  totalPoints: number;
  eventPoints: number;
  ppg: number;
  form: number;
  minutes: number;
  starts: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  saves: number;
  bonus: number;
  bps: number;
  yellowCards: number;
  redCards: number;

  xG: number;
  xA: number;
  xGI: number;
  xG90: number;
  xA90: number;
  xGI90: number;
  xGC90: number;
  dc: number;
  dc90: number;
  ict: number;
  threat: number;
  creativity: number;
  influence: number;

  selectedBy: number;
  transfersInEvent: number;
  transfersOutEvent: number;
  netTransfers: number;
  costChangeStart: number;
  costChangeEvent: number;

  penaltyOrder: number | null;
  cornerOrder: number | null;
  freekickOrder: number | null;

  xPtsNext: number;
  xPts: number;
  xMins: number;
  startProb: number;
  value: number;
  rating: number;
  fdr: number;
  fixtures: FixtureChip[];
  /** European ties up to the last fixture in `fixtures`, soonest first */
  otherGames: OtherGame[];
}

const num = (v: string | number | null | undefined) => {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function toRow(
  p: FplElement,
  proj: PlayerProjection,
  teams: Map<number, FplTeam>,
  schedule?: TeamSchedule,
): PlayerRow {
  const team = teams.get(p.team);
  const fixtures: FixtureChip[] = proj.fixtures.map((f) => ({
    event: f.event,
    opponent: teams.get(f.opponent)?.short_name ?? "?",
    opponentId: f.opponent,
    isHome: f.isHome,
    difficulty: f.difficulty,
    xPts: Math.round(f.points * 100) / 100,
    xMins: Math.round(f.minutes),
    kickoff: f.kickoff,
    congested: schedule?.congested.has(f.fixtureId) ?? false,
  }));

  // Other games are listed only as far ahead as the league fixtures shown beside them.
  const last = proj.fixtures.reduce(
    (max, f) => Math.max(max, f.kickoff ? Date.parse(f.kickoff) : 0),
    0,
  );
  const otherGames: OtherGame[] = (schedule?.others ?? [])
    .filter((o) => Date.parse(o.kickoff) <= last)
    .map((o) => ({
      kickoff: o.kickoff,
      competition: o.competition,
      opponent: o.opponent,
      isHome: o.home,
    }));

  const fdr = fixtures.length
    ? fixtures.reduce((a, f) => a + f.difficulty, 0) / fixtures.length
    : 3;

  return {
    id: p.id,
    code: p.code,
    name: p.web_name,
    fullName: `${p.first_name} ${p.second_name}`,
    team: team?.short_name ?? "?",
    teamId: p.team,
    teamName: team?.name ?? "Unknown",
    pos: POSITIONS[p.element_type] ?? "?",
    posId: p.element_type,
    cost: p.now_cost / 10,
    status: p.status,
    news: p.news,
    availability: p.chance_of_playing_next_round,
    daysAtClub: p.team_join_date
      ? Math.max(0, Math.round((Date.now() - Date.parse(p.team_join_date)) / 86_400_000))
      : null,
    newsSource: p.scout_news_link ?? "",
    newsAdded: p.news_added ?? null,

    totalPoints: p.total_points,
    eventPoints: p.event_points,
    ppg: num(p.points_per_game),
    form: num(p.form),
    minutes: p.minutes,
    starts: p.starts,
    goals: p.goals_scored,
    assists: p.assists,
    cleanSheets: p.clean_sheets,
    saves: p.saves,
    bonus: p.bonus,
    bps: p.bps,
    yellowCards: p.yellow_cards,
    redCards: p.red_cards,

    xG: num(p.expected_goals),
    xA: num(p.expected_assists),
    xGI: num(p.expected_goal_involvements),
    xG90: p.expected_goals_per_90,
    xA90: p.expected_assists_per_90,
    xGI90: p.expected_goal_involvements_per_90,
    xGC90: p.expected_goals_conceded_per_90,
    dc: p.defensive_contribution,
    dc90: p.defensive_contribution_per_90,
    ict: num(p.ict_index),
    threat: num(p.threat),
    creativity: num(p.creativity),
    influence: num(p.influence),

    selectedBy: num(p.selected_by_percent),
    transfersInEvent: p.transfers_in_event,
    transfersOutEvent: p.transfers_out_event,
    netTransfers: p.transfers_in_event - p.transfers_out_event,
    costChangeStart: p.cost_change_start / 10,
    costChangeEvent: p.cost_change_event / 10,

    penaltyOrder: p.penalties_order,
    cornerOrder: p.corners_and_indirect_freekicks_order,
    freekickOrder: p.direct_freekicks_order,

    xPtsNext: Math.round(proj.next * 100) / 100,
    xPts: Math.round(proj.horizon * 100) / 100,
    xMins: Math.round(proj.minutes),
    startProb: Math.round(proj.startProb * 100) / 100,
    value: Math.round(proj.value * 100) / 100,
    rating: Math.round(proj.rating * 10) / 10,
    fdr: Math.round(fdr * 100) / 100,
    fixtures,
    otherGames,
  };
}

