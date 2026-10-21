import { describe, expect, it } from "vitest";
import { row, squad } from "@/test/factories";
import { bestXI, optimiseSquad, planTransfers } from "./optimiser";
import type { PlayerRow } from "./row";

function legal(s: PlayerRow[], budget: number) {
  const byPos = [1, 2, 3, 4].map((pos) => s.filter((p) => p.posId === pos).length);
  const clubs = new Map<number, number>();
  for (const p of s) clubs.set(p.teamId, (clubs.get(p.teamId) ?? 0) + 1);
  return {
    quota: byPos.join("/"),
    maxClub: Math.max(...clubs.values()),
    cost: s.reduce((a, p) => a + p.cost, 0),
    unique: new Set(s.map((p) => p.id)).size === s.length,
    budget,
  };
}

/** Eight players per position across ten clubs, with varied prices and points. */
function pool(): PlayerRow[] {
  const out: PlayerRow[] = [];
  let n = 0;
  for (const pos of [1, 2, 3, 4]) {
    for (let i = 0; i < 8; i++) {
      n++;
      out.push(
        row({ posId: pos, teamId: (n % 10) + 1, cost: 4 + (i % 5) * 1.5, xPts: 10 + i * 3 + pos, xPtsNext: 2 + i }),
      );
    }
  }
  return out;
}

describe("bestXI", () => {
  it("picks one keeper and a legal shape, captaining the best starter", () => {
    const s = squad();
    s.forEach((p, i) => (p.xPtsNext = i));
    const xi = bestXI(s);
    expect(xi.starters).toHaveLength(11);
    expect(xi.starters.filter((p) => p.posId === 1)).toHaveLength(1);
    expect(xi.captain?.xPtsNext).toBe(Math.max(...xi.starters.map((p) => p.xPtsNext)));
    expect(xi.bench[xi.bench.length - 1].posId).toBe(1);
  });

  it("respects a fixed formation", () => {
    expect(bestXI(squad(), "xPtsNext", [5, 4, 1]).formation).toBe("5-4-1");
  });
});

describe("optimiseSquad", () => {
  it("returns a legal squad within budget", () => {
    const res = optimiseSquad(pool(), { budget: 90 });
    const l = legal(res.squad, 90);
    expect(l.quota).toBe("2/5/5/3");
    expect(l.maxClub).toBeLessThanOrEqual(3);
    expect(l.cost).toBeLessThanOrEqual(90 + 1e-9);
    expect(l.unique).toBe(true);
  });

  it("still finds a squad at a tight budget", () => {
    // The cheapest legal squad in this pool costs £73.5m.
    const res = optimiseSquad(pool(), { budget: 75 });
    expect(res.squad).toHaveLength(15);
    expect(legal(res.squad, 75).cost).toBeLessThanOrEqual(75 + 1e-9);
  });

  it("returns nothing when no legal squad fits the budget", () => {
    expect(optimiseSquad(pool(), { budget: 70 }).squad).toEqual([]);
  });

  it("relaxes a filter rather than returning nothing, and says so", () => {
    const res = optimiseSquad(pool(), { budget: 90, minStartProb: 0.99 });
    expect(res.squad).toHaveLength(15);
    expect(res.relaxed).toEqual(["99%+ chance of starting"]);
  });
});

describe("planTransfers", () => {
  it("charges 4 points for each move beyond the free transfers", () => {
    const s = squad();
    s.forEach((p) => (p.xPts = 5));
    const upgrades = [2, 3, 4].map((pos) => row({ posId: pos, teamId: 9 + pos, cost: 5, xPts: 30 }));
    const plans = planTransfers(s, [...s, ...upgrades], { bank: 0, freeTransfers: 1 });
    expect(plans.map((p) => p.hitCost)).toEqual([0, 4, 8]);
    expect(plans[0].netGain).toBe(plans[0].gain);
    expect(plans[2].netGain).toBeCloseTo(plans[2].gain - 8);
  });

  it("makes no move when nothing improves the squad", () => {
    expect(planTransfers(squad(), squad(), { bank: 0, freeTransfers: 1 })).toEqual([]);
  });
});
