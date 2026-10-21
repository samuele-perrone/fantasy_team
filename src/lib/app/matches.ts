import "server-only";
import { getEntryPicks, getEventFixtures, getLive } from "@/lib/fpl/client";
import { getGameData } from "@/lib/fpl/data";
import {
  buildMatch,
  defaultEvent,
  groupByDay,
  type MatchDayGroup,
} from "@/lib/fpl/matches";
import type { LiveElement } from "@/lib/fpl/types";

export interface MatchdayView {
  event: number;
  prev: number | null;
  next: number | null;
  /** any match in progress, so the page knows to keep refreshing */
  live: boolean;
  /** whether a squad was available to highlight */
  hasSquad: boolean;
  days: MatchDayGroup[];
}

/**
 * The manager's squad for a gameweek, for highlighting. Picks only exist once a deadline has
 * passed, so a future gameweek uses the latest squad FPL will show.
 */
async function squadIds(entryId: number, event: number, current: number | null) {
  const candidates = [...new Set([Math.min(event, current ?? event), current])].filter(
    (e): e is number => typeof e === "number" && e >= 1,
  );
  for (const e of candidates) {
    try {
      return new Set((await getEntryPicks(entryId, e)).picks.map((p) => p.element));
    } catch {
      continue;
    }
  }
  return null;
}

/** Every Premier League match in a gameweek, with the manager's players highlighted. */
export async function getMatchday(
  requested: number | null,
  { entryId, watchIds }: { entryId: number | null; watchIds: number[] },
): Promise<MatchdayView> {
  const data = await getGameData();
  const ids = data.events.map((e) => e.id);
  const event =
    requested && ids.includes(requested) ? requested : defaultEvent(data.events);

  const [fixtures, squad] = await Promise.all([
    getEventFixtures(event),
    entryId ? squadIds(entryId, event, data.currentEvent?.id ?? null) : Promise.resolve(null),
  ]);

  // The live endpoint is only worth fetching once something has kicked off.
  let live = new Map<number, LiveElement>();
  if (fixtures.some((f) => f.started)) {
    try {
      live = new Map((await getLive(event)).elements.map((e) => [e.id, e]));
    } catch {
      // Scores still come from the fixtures; only per-player points are lost.
    }
  }

  const ctx = {
    teams: data.teams,
    elements: new Map(data.bootstrap.elements.map((e) => [e.id, e])),
    live,
    squadIds: squad ?? new Set<number>(),
    watchIds: new Set(watchIds),
  };
  const matches = fixtures.map((f) => buildMatch(f, ctx));

  return {
    event,
    prev: ids.includes(event - 1) ? event - 1 : null,
    next: ids.includes(event + 1) ? event + 1 : null,
    live: matches.some((m) => m.status === "live"),
    hasSquad: Boolean(squad),
    days: groupByDay(matches),
  };
}
