import "server-only";
import type {
  Bootstrap,
  ElementSummary,
  Entry,
  EntryPicks,
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
async function fplFetch<T>(path: string, revalidate: number): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
      Accept: "application/json",
    },
    next: { revalidate },
  });

  if (!res.ok) {
    throw new FplError(`FPL request failed (${res.status}) for ${path}`, res.status);
  }
  return (await res.json()) as T;
}

export class FplError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "FplError";
    this.status = status;
  }
}

export const getBootstrap = () => fplFetch<Bootstrap>("/bootstrap-static/", 300);

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

