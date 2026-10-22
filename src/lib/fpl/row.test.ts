import { describe, expect, it } from "vitest";
import { element, team } from "@/test/factories";
import type { PlayerProjection } from "./projection";
import { toRow } from "./row";

const projection: PlayerProjection = {
  id: 1,
  next: 4.567,
  horizon: 20.123,
  per90: 5,
  minutes: 78.4,
  startProb: 0.912,
  value: 3.3,
  rating: 6.66,
  fixtures: [
    { event: 10, fixtureId: 1, kickoff: "2030-01-05T15:00:00Z", opponent: 2, isHome: true, difficulty: 2, points: 4.444, minutes: 78.6, cleanSheetProb: 0, goalProb: 0, assistProb: 0, returnProb: 0 },
    { event: 11, fixtureId: 2, kickoff: "2030-01-12T15:00:00Z", opponent: 2, isHome: false, difficulty: 4, points: 3.333, minutes: 0.4, cleanSheetProb: 0, goalProb: 0, assistProb: 0, returnProb: 0 },
  ],
};

describe("toRow", () => {
  const teams = new Map([[1, team(1, { short_name: "ARS", name: "Arsenal" })], [2, team(2, { short_name: "CHE" })]]);
  const r = toRow(
    element({
      id: 1,
      team: 1,
      element_type: 2,
      now_cost: 65,
      form: "5.5",
      news: "Knock",
      news_added: "2026-10-19T10:00:00Z",
      chance_of_playing_next_round: 75,
    }),
    projection,
    teams,
  );

  it("converts FPL's units into the app's", () => {
    expect(r.cost).toBe(6.5);
    expect(r.pos).toBe("DEF");
    expect(r.team).toBe("ARS");
    expect(r.form).toBe(5.5);
    expect(r.availability).toBe(75);
  });

  it("carries the news and when it was published", () => {
    expect(r.news).toBe("Knock");
    expect(r.newsAdded).toBe("2026-10-19T10:00:00Z");
  });

  it("rounds projections for display and keeps minutes per fixture", () => {
    expect(r.xPtsNext).toBe(4.57);
    expect(r.xPts).toBe(20.12);
    expect(r.xMins).toBe(78);
    expect(r.fixtures.map((f) => f.xMins)).toEqual([79, 0]);
    expect(r.fixtures[1]).toMatchObject({ opponent: "CHE", isHome: false, xPts: 3.33 });
  });

  it("averages fixture difficulty", () => {
    expect(r.fdr).toBe(3);
  });

  it("marks congested fixtures and lists other games only as far as the last league fixture", () => {
    const other = (kickoff: string, opponent: string) => ({
      id: 1, teamId: 1, kickoff, competition: "Champions League", opponent, home: true,
    });
    const withSchedule = toRow(element({ id: 1, team: 1 }), projection, teams, {
      congested: new Set([2]),
      others: [other("2030-01-08T20:00:00Z", "Inter"), other("2030-01-20T20:00:00Z", "Ajax")],
    });
    expect(withSchedule.fixtures.map((f) => f.congested)).toEqual([false, true]);
    expect(withSchedule.otherGames).toEqual([
      { kickoff: "2030-01-08T20:00:00Z", competition: "Champions League", opponent: "Inter", isHome: true },
    ]);
  });

  it("has no other games and nothing congested without a schedule", () => {
    expect(r.otherGames).toEqual([]);
    expect(r.fixtures.every((f) => !f.congested)).toBe(true);
  });
});
