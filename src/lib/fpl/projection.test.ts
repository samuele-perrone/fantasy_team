import { describe, expect, it } from "vitest";
import { bootstrap, element, fixture } from "@/test/factories";
import { buildContext, projectPlayer, upcomingFixtures } from "./projection";

/** A code present in priors.json, so the positional baseline has data to average. */
const PRIOR_CODE = 226597;

function context(elements = [element({ code: PRIOR_CODE, element_type: 3, minutes: 700, starts: 8 })]) {
  const { bootstrap: bs, fixtures } = bootstrap(elements);
  return { bs, fixtures, ctx: buildContext(bs, fixtures) };
}

describe("buildContext", () => {
  it("counts a match as played once it is provisionally finished", () => {
    const { bootstrap: bs, fixtures } = bootstrap([]);
    const extra = fixture({ team_h: 1, team_a: 2, event: 10, finished: false, finished_provisional: true });
    const ctx = buildContext(bs, [...fixtures, extra]);
    expect(ctx.teamGames.get(1)).toBe(10);
  });

  it("counts a started match that has reached 90 minutes", () => {
    const { bootstrap: bs, fixtures } = bootstrap([]);
    const extra = fixture({ team_h: 1, team_a: 2, event: 10, started: true, minutes: 90 });
    expect(buildContext(bs, [...fixtures, extra]).teamGames.get(2)).toBe(10);
  });

  it("finds the next gameweek", () => {
    expect(context().ctx.nextEvent).toBe(10);
  });
});

describe("upcomingFixtures", () => {
  it("returns unfinished fixtures within the horizon only", () => {
    const { ctx } = context();
    const events = upcomingFixtures(1, ctx, 3).map((f) => f.event);
    expect(events).toEqual([10, 11, 12]);
  });
});

describe("projectPlayer", () => {
  it("projects one fixture per upcoming gameweek", () => {
    const { bs, ctx } = context();
    const p = projectPlayer(bs.elements[0], ctx, 5);
    expect(p.fixtures).toHaveLength(5);
    expect(p.horizon).toBeCloseTo(p.fixtures.reduce((a, f) => a + f.points, 0));
  });

  it("shrinks a tiny sample for a player with no prior toward his position", () => {
    // Three minutes with 0.43 xG is about 13 goals per 90 taken at face value.
    const cameo = element({ element_type: 3, minutes: 3, expected_goals: "0.43", now_cost: 50 });
    const { bs, ctx } = context([element({ code: PRIOR_CODE, element_type: 3, minutes: 700, starts: 8 }), cameo]);
    const p = projectPlayer(bs.elements[1], ctx, 5);
    expect(Math.max(...p.fixtures.map((f) => f.goalProb))).toBeLessThan(0.1);
    expect(p.horizon).toBeLessThan(10);
  });

  it("leaves a player with no prior and no minutes without attacking output", () => {
    const unknown = element({ element_type: 3, minutes: 0, now_cost: 45 });
    const { bs, ctx } = context([element({ code: PRIOR_CODE, element_type: 3, minutes: 700, starts: 8 }), unknown]);
    const p = projectPlayer(bs.elements[1], ctx, 5);
    expect(p.fixtures.every((f) => f.goalProb === 0 && f.assistProb === 0)).toBe(true);
  });

  it("projects nothing for fixtures an injured player misses", () => {
    const injured = element({
      code: PRIOR_CODE,
      element_type: 3,
      minutes: 700,
      starts: 8,
      status: "i",
      news: "Unknown return date",
      chance_of_playing_next_round: 0,
    });
    const { bs, ctx } = context([injured]);
    const p = projectPlayer(bs.elements[0], ctx, 5);
    expect(p.horizon).toBe(0);
    expect(p.fixtures.every((f) => f.minutes === 0)).toBe(true);
  });

  it("gives a nailed starter more minutes than a bench player", () => {
    const starter = element({ code: PRIOR_CODE, element_type: 3, minutes: 810, starts: 9 });
    const bench = element({ element_type: 3, minutes: 40, starts: 0, now_cost: 45 });
    const { bs, ctx } = context([starter, bench]);
    expect(projectPlayer(bs.elements[0], ctx).startProb).toBeGreaterThan(
      projectPlayer(bs.elements[1], ctx).startProb + 0.3,
    );
  });
});
