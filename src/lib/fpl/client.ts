import "server-only";
import { unstable_cache } from "next/cache";
import type {
  Bootstrap,
  ElementSummary,
  Entry,
  EntryPicks,
  FplElement,
  FplFixture,
  LeagueStandings,
  LiveElement,
} from "./types";

/** Override to point at a caching proxy or a fixture server during testing. */
const BASE = process.env.FPL_API_BASE ?? "https://fantasy.premierleague.com/api";

/**
 * The FPL API rejects requests without a browser-ish UA and has no CORS headers,
 * so every call is proxied through the server with a revalidating fetch cache.
 */
/** Rate limiting and upstream blips are worth retrying; a 404 never is. */
const RETRYABLE = new Set([403, 408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fplFetch<T>(
  path: string,
  revalidate: number | "no-store",
  attempts = 4,
): Promise<T> {
  let lastStatus = 0;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      // Exponential backoff with jitter. A production build renders many pages across
      // parallel workers, and React's request cache does not span processes, so several
      // concurrent bootstrap requests hit FPL at once and get rate limited. Staggering the
      // retries is what lets the build through.
      const backoff = 400 * 2 ** (attempt - 1);
      await sleep(backoff + Math.random() * 400);
    }

    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
          Accept: "application/json",
        },
        // "no-store" is used where an outer unstable_cache caches the trimmed result instead.
        ...(revalidate === "no-store"
          ? { cache: "no-store" as const }
          : { next: { revalidate } }),
      });
    } catch {
      lastStatus = 0; // network error — retry
      continue;
    }

    if (res.ok) return (await res.json()) as T;

    lastStatus = res.status;
    if (!RETRYABLE.has(res.status)) break;
  }

  throw new FplError(
    `FPL request failed (${lastStatus || "network error"}) for ${path} after ${attempts} attempts`,
    lastStatus || 503,
  );
}

export class FplError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "FplError";
    this.status = status;
  }
}

/**
 * `bootstrap-static` is ~2.1MB serialised, over Next's 2MB data-cache entry limit, so caching
 * the raw response silently fails and every request refetches the whole thing from FPL.
 *
 * The response carries ~109 fields per player and this app reads 54 of them, so the payload is
 * trimmed to those before it is cached. The fetch itself is deliberately uncached — it is
 * `unstable_cache` that stores the small, already-trimmed result.
 */
function slimElement(raw: FplElement): FplElement {
  return {
    id: raw.id,
    code: raw.code,
    web_name: raw.web_name,
    first_name: raw.first_name,
    second_name: raw.second_name,
    team: raw.team,
    team_code: raw.team_code,
    element_type: raw.element_type,
    now_cost: raw.now_cost,
    status: raw.status,
    news: raw.news,
    chance_of_playing_next_round: raw.chance_of_playing_next_round,
    team_join_date: raw.team_join_date,
    total_points: raw.total_points,
    event_points: raw.event_points,
    points_per_game: raw.points_per_game,
    form: raw.form,
    selected_by_percent: raw.selected_by_percent,
    transfers_in_event: raw.transfers_in_event,
    transfers_out_event: raw.transfers_out_event,
    cost_change_start: raw.cost_change_start,
    cost_change_event: raw.cost_change_event,
    minutes: raw.minutes,
    starts: raw.starts,
    goals_scored: raw.goals_scored,
    assists: raw.assists,
    clean_sheets: raw.clean_sheets,
    penalties_saved: raw.penalties_saved,
    yellow_cards: raw.yellow_cards,
    red_cards: raw.red_cards,
    saves: raw.saves,
    bonus: raw.bonus,
    bps: raw.bps,
    influence: raw.influence,
    creativity: raw.creativity,
    threat: raw.threat,
    ict_index: raw.ict_index,
    defensive_contribution: raw.defensive_contribution,
    recoveries: raw.recoveries,
    tackles: raw.tackles,
    expected_goals: raw.expected_goals,
    expected_assists: raw.expected_assists,
    expected_goal_involvements: raw.expected_goal_involvements,
    expected_goals_per_90: raw.expected_goals_per_90,
    expected_assists_per_90: raw.expected_assists_per_90,
    expected_goal_involvements_per_90: raw.expected_goal_involvements_per_90,
    expected_goals_conceded_per_90: raw.expected_goals_conceded_per_90,
    saves_per_90: raw.saves_per_90,
    defensive_contribution_per_90: raw.defensive_contribution_per_90,
    penalties_order: raw.penalties_order,
    penalties_text: raw.penalties_text,
    corners_and_indirect_freekicks_order: raw.corners_and_indirect_freekicks_order,
    corners_and_indirect_freekicks_text: raw.corners_and_indirect_freekicks_text,
    direct_freekicks_order: raw.direct_freekicks_order,
    direct_freekicks_text: raw.direct_freekicks_text,
  };
}

export const getBootstrap = unstable_cache(
  async (): Promise<Bootstrap> => {
    const raw = await fplFetch<Bootstrap>("/bootstrap-static/", "no-store");
    return {
      events: raw.events,
      teams: raw.teams,
      total_players: raw.total_players,
      elements: raw.elements.map(slimElement),
    };
  },
  ["fpl-bootstrap"],
  { revalidate: 300, tags: ["fpl"] },
);

export const getFixtures = () => fplFetch<FplFixture[]>("/fixtures/", 300);

export const getElementSummary = (id: number) =>
  fplFetch<ElementSummary>(`/element-summary/${id}/`, 600);

export const getEntry = (id: number) => fplFetch<Entry>(`/entry/${id}/`, 60);

export const getEntryPicks = (id: number, event: number) =>
  fplFetch<EntryPicks>(`/entry/${id}/event/${event}/picks/`, 60);

export const getEntryHistory = (id: number) =>
  fplFetch<{
    current: {
      event: number;
      points: number;
      total_points: number;
      rank: number | null;
      overall_rank: number | null;
      bank: number;
      value: number;
      event_transfers: number;
      event_transfers_cost: number;
      points_on_bench: number;
    }[];
    past: { season_name: string; total_points: number; rank: number }[];
    chips: { name: string; event: number }[];
  }>(`/entry/${id}/history/`, 60);

export const getLive = (event: number) =>
  fplFetch<{ elements: LiveElement[] }>(`/event/${event}/live/`, 30);

export const getLeagueStandings = (id: number, page = 1) =>
  fplFetch<LeagueStandings>(
    `/leagues-classic/${id}/standings/?page_standings=${page}`,
    120,
  );

