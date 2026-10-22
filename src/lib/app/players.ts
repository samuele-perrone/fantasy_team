import "server-only";
import { getGameData, getPlayerRows } from "@/lib/fpl/data";
import type { PlayerRow } from "@/lib/fpl/row";
import { VERDICT_RULES } from "@/lib/fpl/verdict";
import { foldName } from "@/lib/utils";

/** The orders the Players tab offers, each with the number it shows on the row. */
export const SORTS = {
  points5: { label: "Points next 5", value: (r: PlayerRow) => r.xPts, show: (r: PlayerRow) => `${r.xPts.toFixed(1)} pts next 5` },
  next: { label: "Points next game", value: (r: PlayerRow) => r.xPtsNext, show: (r: PlayerRow) => `${r.xPtsNext.toFixed(1)} pts next game` },
  form: { label: "Form", value: (r: PlayerRow) => r.form, show: (r: PlayerRow) => `form ${r.form.toFixed(1)}` },
  season: { label: "Season points", value: (r: PlayerRow) => r.totalPoints, show: (r: PlayerRow) => `${r.totalPoints} pts this season` },
  price: { label: "Price", value: (r: PlayerRow) => r.cost, show: (r: PlayerRow) => `£${r.cost.toFixed(1)}m` },
  picked: { label: "Most picked", value: (r: PlayerRow) => r.selectedBy, show: (r: PlayerRow) => `${r.selectedBy.toFixed(1)}% picked` },
} as const;

export type SortKey = keyof typeof SORTS;

export const PAGE_SIZE = 30;
const MAX_LIMIT = 300;

export interface BrowseQuery {
  q: string;
  /** FPL element type, 1–4 */
  pos: number | null;
  team: number | null;
  /** £m */
  maxPrice: number | null;
  sort: SortKey;
  limit: number;
}

const first = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? undefined;
const POSITIONS: Record<string, number> = { GKP: 1, DEF: 2, MID: 3, FWD: 4 };

/**
 * Reads the browse filters from a URL's search params, discarding anything malformed rather
 * than failing: a hand-edited or stale link still shows players.
 */
export function parseBrowseQuery(
  params: Record<string, string | string[] | undefined> | URLSearchParams,
): BrowseQuery {
  const get = (k: string) =>
    params instanceof URLSearchParams ? (params.get(k) ?? undefined) : first(params[k]);
  const sort = get("sort");
  const team = Number(get("team"));
  const max = Number(get("max"));
  const n = Number(get("n"));
  return {
    q: (get("q") ?? "").trim().slice(0, 40),
    pos: POSITIONS[get("pos")?.toUpperCase() ?? ""] ?? null,
    team: Number.isInteger(team) && team > 0 ? team : null,
    maxPrice: Number.isFinite(max) && max > 0 ? max : null,
    // Object.hasOwn, not `in`: "toString" is in every object and would crash the sort.
    sort: sort && Object.hasOwn(SORTS, sort) ? (sort as SortKey) : "points5",
    limit: Number.isInteger(n) && n > 0 ? Math.min(n, MAX_LIMIT) : PAGE_SIZE,
  };
}

/** Filters and orders players; `total` is how many matched before the page was cut. */
export function filterPlayers(
  rows: PlayerRow[],
  query: BrowseQuery,
): { players: PlayerRow[]; total: number } {
  const needle = query.q.length >= 2 ? foldName(query.q) : null;
  const value = SORTS[query.sort].value;
  const matched = rows
    .filter((r) => query.pos === null || r.posId === query.pos)
    .filter((r) => query.team === null || r.teamId === query.team)
    // Prices are in tenths, so compare in tenths to keep £5.0m from failing a £5.0m limit.
    .filter((r) => query.maxPrice === null || Math.round(r.cost * 10) <= Math.round(query.maxPrice * 10))
    .filter(
      (r) => needle === null || foldName(r.name).includes(needle) || foldName(r.fullName).includes(needle),
    )
    // Ties fall back to points next 5, so equal prices or season totals still list the
    // likelier scorers first.
    .sort((a, b) => value(b) - value(a) || b.xPts - a.xPts || a.id - b.id);
  return { players: matched.slice(0, query.limit), total: matched.length };
}

export interface PlayersView {
  players: PlayerRow[];
  total: number;
  query: BrowseQuery;
  teams: { id: number; name: string; short: string }[];
}

/** The Players tab: every available player, filtered and sorted as the URL asks. */
export async function browsePlayers(query: BrowseQuery): Promise<PlayersView> {
  const [rows, data] = await Promise.all([getPlayerRows(VERDICT_RULES.horizon), getGameData()]);
  const teams = [...data.teams.values()]
    .map((t) => ({ id: t.id, name: t.name, short: t.short_name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ...filterPlayers(rows, query), query, teams };
}
