import type { FixtureChip, PlayerRow } from "@/lib/fpl/row";
import type { Bootstrap, FplElement, FplEvent, FplFixture, FplTeam } from "@/lib/fpl/types";

/**
 * Builders for test data. Every field gets a neutral default, so a test states only the
 * fields its behaviour depends on.
 */

let nextId = 1000;

export function fixtureChip(event: number, partial: Partial<FixtureChip> = {}): FixtureChip {
  return {
    event,
    opponent: "OPP",
    opponentId: 99,
    isHome: true,
    difficulty: 3,
    xPts: 4,
    xMins: 80,
    kickoff: null,
    congested: false,
    ...partial,
  };
}

/**
 * A player with one fixture per gameweek from `nextEvent`, each worth `perGame` points. Pass
 * `fixtures` to control them exactly.
 */
export function row(
  partial: Partial<PlayerRow> & { perGame?: number; nextEvent?: number } = {},
): PlayerRow {
  const { perGame = 4, nextEvent = 10, ...rest } = partial;
  const id = rest.id ?? nextId++;
  const fixtures =
    rest.fixtures ?? [0, 1, 2, 3, 4].map((i) => fixtureChip(nextEvent + i, { xPts: perGame }));
  return {
    id,
    code: id,
    name: `P${id}`,
    fullName: `Player ${id}`,
    team: "AAA",
    teamId: 1,
    teamName: "Alpha",
    pos: "MID",
    posId: 3,
    cost: 6,
    status: "a",
    news: "",
    availability: null,
    daysAtClub: 500,
    newsSource: "",
    newsAdded: null,
    totalPoints: 0,
    eventPoints: 0,
    ppg: 0,
    form: 3,
    minutes: 600,
    starts: 7,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    saves: 0,
    bonus: 0,
    bps: 0,
    yellowCards: 0,
    redCards: 0,
    xG: 0,
    xA: 0,
    xGI: 0,
    xG90: 0,
    xA90: 0,
    xGI90: 0,
    xGC90: 0,
    dc: 0,
    dc90: 0,
    ict: 0,
    threat: 0,
    creativity: 0,
    influence: 0,
    selectedBy: 0,
    transfersInEvent: 0,
    transfersOutEvent: 0,
    netTransfers: 0,
    costChangeStart: 0,
    costChangeEvent: 0,
    penaltyOrder: null,
    cornerOrder: null,
    freekickOrder: null,
    xPtsNext: perGame,
    xPts: perGame * 5,
    xMins: 80,
    startProb: 0.9,
    value: 0,
    rating: 5,
    fdr: 3,
    otherGames: [],
    ...rest,
    fixtures,
  };
}

/** A legal 2/5/5/3 squad spread over five clubs, three players each. */
export function squad(perGame = 4, cost = 5): PlayerRow[] {
  const positions = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4];
  const names = ["", "GKP", "DEF", "MID", "FWD"];
  return positions.map((posId, i) =>
    row({ posId, pos: names[posId], teamId: (i % 5) + 1, cost, perGame }),
  );
}

export function element(partial: Partial<FplElement> = {}): FplElement {
  const id = partial.id ?? nextId++;
  return {
    id,
    code: id,
    web_name: `E${id}`,
    first_name: "First",
    second_name: `Last${id}`,
    team: 1,
    team_code: 1,
    element_type: 3,
    now_cost: 60,
    status: "a",
    news: "",
    chance_of_playing_next_round: null,
    team_join_date: "2020-07-01",
    scout_news_link: "",
    news_added: null,
    total_points: 0,
    event_points: 0,
    points_per_game: "0.0",
    form: "0.0",
    selected_by_percent: "0.0",
    transfers_in_event: 0,
    transfers_out_event: 0,
    cost_change_start: 0,
    cost_change_event: 0,
    minutes: 0,
    starts: 0,
    goals_scored: 0,
    assists: 0,
    clean_sheets: 0,
    penalties_saved: 0,
    yellow_cards: 0,
    red_cards: 0,
    saves: 0,
    bonus: 0,
    bps: 0,
    influence: "0",
    creativity: "0",
    threat: "0",
    ict_index: "0",
    defensive_contribution: 0,
    recoveries: 0,
    tackles: 0,
    expected_goals: "0",
    expected_assists: "0",
    expected_goal_involvements: "0",
    expected_goals_per_90: 0,
    expected_assists_per_90: 0,
    expected_goal_involvements_per_90: 0,
    expected_goals_conceded_per_90: 0,
    saves_per_90: 0,
    defensive_contribution_per_90: 0,
    penalties_order: null,
    penalties_text: "",
    corners_and_indirect_freekicks_order: null,
    corners_and_indirect_freekicks_text: "",
    direct_freekicks_order: null,
    direct_freekicks_text: "",
    ...partial,
  };
}

export function team(id: number, partial: Partial<FplTeam> = {}): FplTeam {
  return {
    id,
    code: id,
    name: `Team ${id}`,
    short_name: `T${id}`,
    strength: 3,
    position: id,
    played: 0,
    points: 0,
    win: 0,
    draw: 0,
    loss: 0,
    form: null,
    strength_overall_home: 0,
    strength_overall_away: 0,
    strength_attack_home: 0,
    strength_attack_away: 0,
    strength_defence_home: 0,
    strength_defence_away: 0,
    ...partial,
  };
}

export function fixture(partial: Partial<FplFixture> & Pick<FplFixture, "team_h" | "team_a">): FplFixture {
  return {
    id: nextId++,
    code: 0,
    event: 10,
    kickoff_time: "2030-01-05T15:00:00Z",
    finished: false,
    finished_provisional: false,
    started: false,
    minutes: 0,
    team_h_score: null,
    team_a_score: null,
    team_h_difficulty: 3,
    team_a_difficulty: 3,
    stats: [],
    ...partial,
  };
}

export function event(id: number, partial: Partial<FplEvent> = {}): FplEvent {
  return {
    id,
    name: `Gameweek ${id}`,
    deadline_time: "2030-01-05T11:00:00Z",
    finished: false,
    is_previous: false,
    is_current: false,
    is_next: false,
    average_entry_score: 0,
    highest_score: null,
    most_selected: null,
    most_transferred_in: null,
    top_element: null,
    most_captained: null,
    most_vice_captained: null,
    transfers_made: 0,
    chip_plays: [],
    ...partial,
  };
}

/** Two clubs, nine played rounds and five upcoming ones, with whatever players are given. */
export function bootstrap(elements: FplElement[]): { bootstrap: Bootstrap; fixtures: FplFixture[] } {
  const fixtures: FplFixture[] = [];
  for (let gw = 1; gw <= 14; gw++) {
    const played = gw < 10;
    fixtures.push(
      fixture({
        team_h: gw % 2 ? 1 : 2,
        team_a: gw % 2 ? 2 : 1,
        event: gw,
        finished: played,
        started: played,
        minutes: played ? 90 : 0,
        kickoff_time: `2030-0${Math.min(9, Math.ceil(gw / 2))}-1${gw % 10}T15:00:00Z`,
      }),
    );
  }
  return {
    bootstrap: {
      events: [
        ...Array.from({ length: 8 }, (_, i) => event(i + 1, { finished: true })),
        event(9, { finished: true, is_current: true }),
        event(10, { is_next: true }),
        ...[11, 12, 13, 14].map((id) => event(id)),
      ],
      teams: [team(1), team(2)],
      elements,
      element_types: [],
      game_settings: undefined as unknown as Bootstrap["game_settings"],
      total_players: 0,
    },
    fixtures,
  };
}

/**
 * A copy of `p` with changes. The fixtures are rebuilt from `perGame` unless given, since
 * spreading `p` would otherwise carry its old fixtures and silently ignore `perGame`.
 */
export function copy(
  p: PlayerRow,
  over: Partial<PlayerRow> & { perGame?: number; nextEvent?: number } = {},
): PlayerRow {
  return row({ ...p, fixtures: undefined as unknown as FixtureChip[], ...over });
}
