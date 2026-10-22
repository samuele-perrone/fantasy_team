import "server-only";
import { cache } from "react";
import { getBootstrap, getFixtures } from "./client";
import { getOtherMatches } from "@/lib/football/client";
import { buildSchedules, type OtherMatch, type TeamSchedule } from "./schedule";
import { buildContext, projectAll, type ProjectionContext } from "./projection";
import { readRules, type SquadRules } from "./rules";
import type { Bootstrap, FplEvent, FplFixture, FplTeam } from "./types";
import { toRow } from "./row";

export { toRow, POSITIONS } from "./row";
export type { PlayerRow, FixtureChip } from "./row";

export interface GameData {
  bootstrap: Bootstrap;
  fixtures: FplFixture[];
  ctx: ProjectionContext;
  teams: Map<number, FplTeam>;
  events: FplEvent[];
  currentEvent: FplEvent | null;
  nextEvent: FplEvent | null;
  seasonStarted: boolean;
  /** squad rules as FPL currently publishes them */
  rules: SquadRules;
  /** European and cup matches for Premier League clubs, from ESPN; empty if it is down */
  otherMatches: OtherMatch[];
  /** per club: other matches still to come, and which league fixtures are congested */
  schedules: Map<number, TeamSchedule>;
  /** when this data was fetched, for surfacing freshness */
  fetchedAt: string;
}

/** Deduped per request — every page shares one bootstrap + fixtures fetch. */
export const getGameData = cache(async (): Promise<GameData> => {
  const [bootstrap, fixtures] = await Promise.all([getBootstrap(), getFixtures()]);
  const otherMatches = await getOtherMatches(bootstrap.teams);
  const ctx = buildContext(bootstrap, fixtures);
  const teams = new Map(bootstrap.teams.map((t) => [t.id, t]));
  const currentEvent = bootstrap.events.find((e) => e.is_current) ?? null;
  const nextEvent = bootstrap.events.find((e) => e.is_next) ?? null;

  return {
    bootstrap,
    fixtures,
    ctx,
    teams,
    events: bootstrap.events,
    currentEvent,
    nextEvent,
    seasonStarted: bootstrap.events.some((e) => e.finished || e.is_current),
    rules: readRules(bootstrap),
    otherMatches,
    schedules: buildSchedules(fixtures, otherMatches),
    fetchedAt: new Date().toISOString(),
  };
});

export async function getPlayerRows(horizon = 5): Promise<import("./row").PlayerRow[]> {
  const data = await getGameData();
  const projections = projectAll(data.bootstrap, data.ctx, horizon);
  return data.bootstrap.elements
    .filter((p) => p.status !== "u")
    .map((p) => toRow(p, projections.get(p.id)!, data.teams, data.schedules.get(p.team)));
}
