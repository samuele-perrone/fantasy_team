export type ElementStatus = "a" | "d" | "i" | "s" | "u" | "n";

/**
 * Only the fields this app actually reads. The API returns ~109 per player; the rest are
 * discarded at the trim boundary in client.ts so the cached payload stays under Next's
 * 2MB data-cache limit.
 */
export interface FplElement {
  id: number;
  code: number;
  web_name: string;
  first_name: string;
  second_name: string;
  team: number;
  team_code: number;
  element_type: number;
  now_cost: number;
  status: ElementStatus;
  news: string;
  chance_of_playing_next_round: number | null;
  /** when the player joined their current club — their stats before it are another team's */
  team_join_date: string | null;
  /** FPL's source for the news, usually the club's press conference write-up */
  scout_news_link: string;
  total_points: number;
  event_points: number;
  points_per_game: string;
  form: string;
  selected_by_percent: string;
  transfers_in_event: number;
  transfers_out_event: number;
  cost_change_start: number;
  cost_change_event: number;
  minutes: number;
  starts: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  penalties_saved: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
  defensive_contribution: number;
  recoveries: number;
  tackles: number;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_per_90: number;
  expected_assists_per_90: number;
  expected_goal_involvements_per_90: number;
  expected_goals_conceded_per_90: number;
  saves_per_90: number;
  defensive_contribution_per_90: number;
  penalties_order: number | null;
  penalties_text: string;
  corners_and_indirect_freekicks_order: number | null;
  corners_and_indirect_freekicks_text: string;
  direct_freekicks_order: number | null;
  direct_freekicks_text: string;
}

export interface FplTeam {
  id: number;
  code: number;
  name: string;
  short_name: string;
  strength: number | null;
  position: number;
  played: number;
  points: number;
  win: number;
  draw: number;
  loss: number;
  form: string | null;
  strength_overall_home: number;
  strength_overall_away: number;
  strength_attack_home: number;
  strength_attack_away: number;
  strength_defence_home: number;
  strength_defence_away: number;
}

export interface FplEvent {
  id: number;
  name: string;
  deadline_time: string;
  finished: boolean;
  is_previous: boolean;
  is_current: boolean;
  is_next: boolean;
  average_entry_score: number;
  highest_score: number | null;
  most_selected: number | null;
  most_transferred_in: number | null;
  top_element: number | null;
  most_captained: number | null;
  most_vice_captained: number | null;
  transfers_made: number;
  chip_plays: { chip_name: string; num_played: number }[];
}

/** Trimmed in client.ts — only the blocks this app reads are cached. */
export interface Bootstrap {
  events: FplEvent[];
  teams: FplTeam[];
  elements: FplElement[];
  total_players: number;
}

export interface FplFixture {
  id: number;
  code: number;
  event: number | null;
  kickoff_time: string | null;
  finished: boolean;
  finished_provisional: boolean;
  started: boolean;
  minutes: number;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
  team_h_difficulty: number;
  team_a_difficulty: number;
  stats: {
    identifier: string;
    a: { value: number; element: number }[];
    h: { value: number; element: number }[];
  }[];
}

export interface ElementSummaryHistory {
  element: number;
  fixture: number;
  opponent_team: number;
  total_points: number;
  was_home: boolean;
  kickoff_time: string;
  round: number;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
  starts: number;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;
  defensive_contribution: number;
  value: number;
  transfers_balance: number;
  selected: number;
  transfers_in: number;
  transfers_out: number;
}

export interface ElementSummary {
  fixtures: {
    id: number;
    event: number | null;
    event_name: string | null;
    is_home: boolean;
    difficulty: number;
    team_h: number;
    team_a: number;
    kickoff_time: string | null;
  }[];
  history: ElementSummaryHistory[];
  history_past: {
    season_name: string;
    total_points: number;
    minutes: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    bonus: number;
    start_cost: number;
    end_cost: number;
  }[];
}

export interface EntryPick {
  element: number;
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
}

export interface EntryPicks {
  active_chip: string | null;
  automatic_subs: { element_in: number; element_out: number }[];
  entry_history: {
    event: number;
    points: number;
    total_points: number;
    rank: number | null;
    rank_sort: number | null;
    overall_rank: number | null;
    bank: number;
    value: number;
    event_transfers: number;
    event_transfers_cost: number;
    points_on_bench: number;
  };
  picks: EntryPick[];
}

export interface Entry {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  summary_overall_points: number | null;
  summary_overall_rank: number | null;
  summary_event_points: number | null;
  summary_event_rank: number | null;
  current_event: number | null;
  last_deadline_bank: number | null;
  last_deadline_value: number | null;
  last_deadline_total_transfers: number | null;
  leagues: {
    classic: { id: number; name: string; entry_rank: number | null; entry_last_rank: number | null }[];
    h2h: { id: number; name: string; entry_rank: number | null }[];
  };
}

export interface LiveElement {
  id: number;
  stats: {
    minutes: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    goals_conceded: number;
    own_goals: number;
    penalties_saved: number;
    penalties_missed: number;
    yellow_cards: number;
    red_cards: number;
    saves: number;
    bonus: number;
    bps: number;
    total_points: number;
    starts: number;
    defensive_contribution: number;
  };
  explain: {
    fixture: number;
    stats: { identifier: string; points: number; value: number }[];
  }[];
}

export interface LeagueStandings {
  league: { id: number; name: string; created: string; league_type: string };
  standings: {
    has_next: boolean;
    page: number;
    results: {
      id: number;
      entry: number;
      entry_name: string;
      player_name: string;
      rank: number;
      last_rank: number;
      rank_sort: number;
      total: number;
      event_total: number;
    }[];
  };
  new_entries: { results: unknown[] };
}
