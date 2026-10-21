import { describe, expect, it } from "vitest";
import { fixture, team } from "@/test/factories";
import {
  attackingMultiplier,
  clamp,
  cleanSheetProbability,
  deriveTeamRatings,
  expectedGoals,
  poissonAtLeast,
  type TeamRating,
} from "./ratings";

const rating = (attack: number, defence = attack): TeamRating => ({
  id: 1,
  homeStrength: 3,
  awayStrength: 3,
  attack,
  defence,
  played: 0,
});

describe("deriveTeamRatings", () => {
  it("reads a team's strength from the difficulty opponents are given against it", () => {
    // Team 1 is strong: whoever visits it is handed difficulty 5.
    const fixtures = [
      fixture({ team_h: 1, team_a: 2, team_a_difficulty: 5, team_h_difficulty: 2 }),
      fixture({ team_h: 2, team_a: 1, team_a_difficulty: 2, team_h_difficulty: 5 }),
    ];
    const r = deriveTeamRatings([team(1), team(2)], fixtures);
    expect(r.get(1)!.attack).toBeGreaterThan(r.get(2)!.attack);
    expect(r.get(1)!.homeStrength).toBe(5);
  });

  it("counts finished matches as played", () => {
    const r = deriveTeamRatings([team(1), team(2)], [fixture({ team_h: 1, team_a: 2, finished: true })]);
    expect(r.get(1)!.played).toBe(1);
  });
});

describe("expectedGoals", () => {
  it("is the league average for two average sides at a neutral venue, adjusted for home", () => {
    const home = expectedGoals(rating(3), rating(3), true);
    const away = expectedGoals(rating(3), rating(3), false);
    expect(home).toBeCloseTo(1.42 * 1.11);
    expect(away).toBeCloseTo(1.42 * 0.9);
  });

  it("rises with attack and falls against a better defence", () => {
    expect(expectedGoals(rating(5), rating(3), true)).toBeGreaterThan(expectedGoals(rating(3), rating(3), true));
    expect(expectedGoals(rating(3), rating(3, 5), true)).toBeLessThan(expectedGoals(rating(3), rating(3), true));
  });
});

describe("derived probabilities", () => {
  it("gives a better clean sheet chance against a weak attack", () => {
    expect(cleanSheetProbability(rating(3), rating(1), true)).toBeGreaterThan(
      cleanSheetProbability(rating(3), rating(5), true),
    );
  });

  it("keeps the attacking multiplier within its bounds", () => {
    expect(attackingMultiplier(rating(5), rating(1, 1), true)).toBeLessThanOrEqual(2.1);
    expect(attackingMultiplier(rating(1), rating(5, 5), false)).toBeGreaterThanOrEqual(0.45);
  });

  it("computes Poisson tail probabilities", () => {
    expect(poissonAtLeast(0, 1)).toBe(0);
    expect(poissonAtLeast(1, 1)).toBeCloseTo(1 - Math.exp(-1));
    expect(poissonAtLeast(2, 0)).toBe(1);
    expect(clamp(5, 0, 1)).toBe(1);
  });
});
