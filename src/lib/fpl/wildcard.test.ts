import { describe, expect, it } from "vitest";
import { row, squad } from "@/test/factories";
import { estimateSellingPrice, planWildcard, WILDCARD_WORTH } from "./wildcard";

describe("estimateSellingPrice", () => {
  it("keeps half of a rise since the season started, rounded down to £0.1m", () => {
    expect(estimateSellingPrice({ cost: 5.5, costChangeStart: 0.5 })).toBe(5.2);
    expect(estimateSellingPrice({ cost: 8.2, costChangeStart: 0.2 })).toBe(8.1);
    expect(estimateSellingPrice({ cost: 8.1, costChangeStart: 0.1 })).toBe(8);
  });

  it("is today's price for a player who has not risen", () => {
    expect(estimateSellingPrice({ cost: 6, costChangeStart: 0 })).toBe(6);
    expect(estimateSellingPrice({ cost: 5.7, costChangeStart: -0.3 })).toBe(5.7);
  });
});

describe("planWildcard", () => {
  it("spends the bank plus what the squad sells for, never more", () => {
    const s = squad(4, 5);
    s[0] = { ...s[0], cost: 5.5, costChangeStart: 0.5 };
    const plan = planWildcard({ squad: s, pool: s, bank: 1 });
    // fourteen at £5.0m, one sold at £5.2m rather than £5.5m, and £1m in the bank
    expect(plan.budget).toBe(76.2);
    expect(plan.cost).toBeLessThanOrEqual(plan.budget);
  });

  it("brings in better players, keeps the ones worth keeping, and counts the gain", () => {
    const s = squad(4, 5);
    const star = row({ posId: 4, pos: "FWD", teamId: 9, cost: 5, perGame: 10, xPts: 50 });
    const plan = planWildcard({ squad: s, pool: [...s, star], bank: 0 });
    const picked = [...plan.starters, ...plan.bench].map((p) => p.id);
    expect(picked).toContain(star.id);
    expect(picked).toHaveLength(15);
    expect(plan.keptIds).toHaveLength(14);
    expect(plan.gain).toBe(30);
    expect(plan.saveIt).toBe(false);
  });

  it("says to save the chip when the squad is already about the best affordable", () => {
    const s = squad(4, 5);
    const slightly = row({ posId: 4, pos: "FWD", teamId: 9, cost: 5, xPts: 20 + WILDCARD_WORTH - 1 });
    const plan = planWildcard({ squad: s, pool: [...s, slightly], bank: 0 });
    expect(plan.gain).toBe(WILDCARD_WORTH - 1);
    expect(plan.saveIt).toBe(true);
  });

  it("calls a gain of exactly the threshold worth it", () => {
    const s = squad(4, 5);
    const better = row({ posId: 4, pos: "FWD", teamId: 9, cost: 5, xPts: 20 + WILDCARD_WORTH });
    expect(planWildcard({ squad: s, pool: [...s, better], bank: 0 }).saveIt).toBe(false);
  });

  it("sets the XI and captain for the next gameweek, not the five", () => {
    const s = squad(4, 5);
    // the weakest midfielder over five gameweeks, but the best next week
    const i = s.findIndex((p) => p.posId === 3);
    s[i] = { ...s[i], xPtsNext: 12, xPts: 15 };
    const plan = planWildcard({ squad: s, pool: s, bank: 0 });
    expect(plan.captainId).toBe(s[i].id);
  });
});

describe("planWildcard with the watchlist", () => {
  const pick = (plan: ReturnType<typeof planWildcard>) =>
    [...plan.starters, ...plan.bench].map((p) => p.id);

  it("builds around a watched player the optimiser would otherwise leave out", () => {
    const s = squad(4, 5);
    // worse than anyone in the squad over five gameweeks, so only the watchlist brings him in
    const watched = row({ posId: 4, pos: "FWD", teamId: 9, cost: 5, xPts: 10 });
    const without = planWildcard({ squad: s, pool: [...s, watched], bank: 0 });
    expect(pick(without)).not.toContain(watched.id);
    const withIt = planWildcard({ squad: s, pool: [...s, watched], bank: 0, watched: [watched] });
    expect(pick(withIt)).toContain(watched.id);
    expect(withIt.watchIds).toEqual([watched.id]);
    expect(withIt.watchSkipped).toEqual([]);
  });

  it("skips a watched player no legal squad within budget can hold, and says so", () => {
    const s = squad(4, 5);
    const pricey = row({ name: "Pricey", posId: 3, pos: "MID", teamId: 9, cost: 30, xPts: 60 });
    const cheap = row({ posId: 4, pos: "FWD", teamId: 8, cost: 5, xPts: 10 });
    const plan = planWildcard({ squad: s, pool: [...s, pricey, cheap], bank: 0, watched: [pricey, cheap] });
    expect(pick(plan)).not.toContain(pricey.id);
    expect(pick(plan)).toContain(cheap.id);
    expect(plan.watchSkipped).toEqual([{ id: pricey.id, name: "Pricey" }]);
    expect(plan.cost).toBeLessThanOrEqual(plan.budget);
  });

  it("does not build around an unavailable player", () => {
    const s = squad(4, 5);
    const out = row({ posId: 4, pos: "FWD", teamId: 9, cost: 5, xPts: 30, status: "u" });
    const plan = planWildcard({ squad: s, pool: [...s, out], bank: 0, watched: [out] });
    expect(plan.watchSkipped.map((w) => w.id)).toEqual([out.id]);
  });

  it("keeps to the club limit when several watched players share a club", () => {
    const s = squad(4, 5);
    const same = [0, 1, 2, 3].map((i) =>
      row({ posId: 3, pos: "MID", teamId: 7, cost: 5, xPts: 10 + i }),
    );
    const plan = planWildcard({ squad: s, pool: [...s, ...same], bank: 0, watched: same });
    expect(plan.watchIds).toHaveLength(3);
    expect(plan.watchSkipped).toHaveLength(1);
  });
});
