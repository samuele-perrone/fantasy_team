import { describe, expect, it } from "vitest";
import { copy, fixtureChip, row, squad } from "@/test/factories";
import {
  bestSwapFor,
  computeVerdicts,
  outGameweeks,
  suggestTransfers,
  VERDICT_RULES,
  weightedScore,
  type VerdictInput,
} from "./verdict";
import type { PlayerRow } from "./row";

const NEXT = 10;

function input(over: Partial<VerdictInput> & { squad: PlayerRow[] }): VerdictInput {
  return { pool: over.squad, bank: 0, freeTransfers: 1, nextEvent: NEXT, ...over };
}

/** Verdict for the squad player with this id. */
function verdictOf(i: VerdictInput, id: number) {
  return computeVerdicts(i).find((v) => v.player.id === id)!;
}

/** Replace the squad's first midfielder with `p`, returning the new squad and that index. */
function withMid(p: Parameters<typeof copy>[1]): { s: PlayerRow[]; mid: PlayerRow } {
  const s = squad();
  const idx = s.findIndex((x) => x.posId === 3);
  const mid = copy(s[idx], p);
  s[idx] = mid;
  return { s, mid };
}

describe("weightedScore", () => {
  it("weights nearer gameweeks more", () => {
    const p = row({ perGame: 10 });
    const expected = VERDICT_RULES.weights.reduce((a, w) => a + 10 * w, 0);
    expect(weightedScore(p, NEXT)).toBeCloseTo(expected);
  });

  it("ignores fixtures beyond the horizon and counts a double gameweek twice", () => {
    const p = row({
      fixtures: [fixtureChip(NEXT, { xPts: 3 }), fixtureChip(NEXT, { xPts: 3 }), fixtureChip(NEXT + 7, { xPts: 50 })],
    });
    expect(weightedScore(p, NEXT)).toBeCloseTo(6);
  });
});

describe("outGameweeks", () => {
  it("counts consecutive gameweeks with no expected minutes", () => {
    const p = row({
      fixtures: [
        fixtureChip(NEXT, { xMins: 0 }),
        fixtureChip(NEXT + 1, { xMins: 0 }),
        fixtureChip(NEXT + 2, { xMins: 70 }),
        fixtureChip(NEXT + 3, { xMins: 0 }),
      ],
    });
    expect(outGameweeks(p, NEXT)).toBe(2);
  });

  it("skips a blank gameweek rather than counting it as missed", () => {
    const p = row({
      fixtures: [fixtureChip(NEXT, { xMins: 0 }), fixtureChip(NEXT + 2, { xMins: 0 }), fixtureChip(NEXT + 3, { xMins: 80 })],
    });
    expect(outGameweeks(p, NEXT)).toBe(2);
  });

  it("is zero for a fit player", () => {
    expect(outGameweeks(row(), NEXT)).toBe(0);
  });
});

describe("computeVerdicts", () => {
  it("keeps a squad when nobody affordable is better", () => {
    const s = squad();
    expect(computeVerdicts(input({ squad: s })).every((v) => v.verdict === "keep")).toBe(true);
  });

  it("sells when an affordable replacement gains 5+ weighted points", () => {
    const { s, mid } = withMid({ perGame: 2 });
    const star = row({ posId: 3, pos: "MID", teamId: 9, cost: 5, perGame: 4 });
    const v = verdictOf(input({ squad: s, pool: [...s, star] }), mid.id);
    expect(v.verdict).toBe("sell");
    expect(v.replacements[0].player.id).toBe(star.id);
    expect(v.gap).toBeGreaterThanOrEqual(VERDICT_RULES.sellGap);
  });

  it("watches when the gap is between 2 and 5", () => {
    const { s, mid } = withMid({ perGame: 3.2 });
    const better = row({ posId: 3, teamId: 9, cost: 5, perGame: 4 });
    const v = verdictOf(input({ squad: s, pool: [...s, better] }), mid.id);
    expect(v.gap).toBeGreaterThanOrEqual(2);
    expect(v.gap).toBeLessThan(5);
    expect(v.verdict).toBe("watch");
    expect(v.reason).toContain("slightly better");
  });

  it("only offers players the manager can afford", () => {
    const { s, mid } = withMid({ perGame: 1, cost: 5 });
    const pricey = row({ posId: 3, teamId: 9, cost: 5.6, perGame: 9 });
    const v1 = verdictOf(input({ squad: s, pool: [...s, pricey], bank: 0.5 }), mid.id);
    expect(v1.replacements.map((r) => r.player.id)).not.toContain(pricey.id);
    const v2 = verdictOf(input({ squad: s, pool: [...s, pricey], bank: 0.6 }), mid.id);
    expect(v2.replacements[0].player.id).toBe(pricey.id);
  });

  it("never offers a fourth player from one club", () => {
    const { s, mid } = withMid({ perGame: 1, teamId: 2 });
    // club 1 already has three players in the default squad
    const fromFullClub = row({ posId: 3, teamId: 1, cost: 5, perGame: 9 });
    const v = verdictOf(input({ squad: s, pool: [...s, fromFullClub] }), mid.id);
    expect(v.replacements.map((r) => r.player.id)).not.toContain(fromFullClub.id);
  });

  it("does allow a club-mate swap that keeps the count at three", () => {
    const s = squad();
    const idx = s.findIndex((x) => x.posId === 3 && x.teamId === 1);
    const weak = copy(s[idx], { perGame: 1 });
    s[idx] = weak;
    const sameClub = row({ posId: 3, teamId: 1, cost: 5, perGame: 9 });
    const v = verdictOf(input({ squad: s, pool: [...s, sameClub] }), weak.id);
    expect(v.replacements[0].player.id).toBe(sameClub.id);
  });

  it("only offers the same position", () => {
    const { s, mid } = withMid({ perGame: 1 });
    const fwd = row({ posId: 4, pos: "FWD", teamId: 9, cost: 5, perGame: 9 });
    const v = verdictOf(input({ squad: s, pool: [...s, fwd] }), mid.id);
    expect(v.replacements).toHaveLength(0);
  });

  it("hides replacements gaining under a point", () => {
    const { s, mid } = withMid({ perGame: 4 });
    const marginal = row({ posId: 3, teamId: 9, cost: 5, perGame: 4.2 });
    const v = verdictOf(input({ squad: s, pool: [...s, marginal] }), mid.id);
    expect(v.replacements).toHaveLength(0);
    expect(v.verdict).toBe("keep");
  });

  it("sells a player ruled out for two gameweeks, saying until when", () => {
    const { s, mid } = withMid({
      status: "i",
      news: "Hamstring injury - Expected back 23 Nov",
      availability: 0,
      fixtures: [0, 1, 2, 3, 4].map((i) => fixtureChip(NEXT + i, { xMins: i < 2 ? 0 : 80, xPts: i < 2 ? 0 : 4 })),
    });
    const v = verdictOf(input({ squad: s }), mid.id);
    expect(v.outGameweeks).toBe(2);
    expect(v.verdict).toBe("sell");
    expect(v.reason).toBe("Out until 23 Nov");
  });

  it("watches a player out for one gameweek", () => {
    const { s, mid } = withMid({
      status: "s",
      fixtures: [0, 1, 2, 3, 4].map((i) => fixtureChip(NEXT + i, { xMins: i === 0 ? 0 : 80 })),
    });
    const v = verdictOf(input({ squad: s }), mid.id);
    expect(v.verdict).toBe("watch");
    expect(v.reason).toBe("Suspended for the next game");
  });

  it("watches a doubt, quoting FPL's news", () => {
    const { s, mid } = withMid({ status: "d", availability: 75, news: "Knock - 75% chance of playing" });
    const v = verdictOf(input({ squad: s }), mid.id);
    expect(v.verdict).toBe("watch");
    expect(v.reason).toBe("Knock - 75% chance of playing");
  });

  it("says when a player has no game this gameweek", () => {
    const { s, mid } = withMid({ fixtures: [1, 2, 3, 4].map((i) => fixtureChip(NEXT + i)) });
    expect(verdictOf(input({ squad: s }), mid.id).reason).toBe("No game this gameweek");
  });

  describe("settling sells as one plan", () => {
    /** Three weak midfielders and a pool of strong ones. */
    function crowded(strong: number[]) {
      const s = squad();
      const mids = s.filter((p) => p.posId === 3).slice(0, 3);
      for (const m of mids) {
        const i = s.indexOf(m);
        s[i] = copy(m, { perGame: 0.5 });
      }
      const weak = s.filter((p) => p.posId === 3 && p.xPtsNext === 0.5);
      const pool = [
        ...s,
        ...strong.map((perGame, i) => row({ posId: 3, teamId: 10 + i, cost: 5, perGame })),
      ];
      return { s, weak, pool };
    }

    it("caps sells at the free transfers when no move clears the hit rule", () => {
      // gains of about 6.6 weighted points: a Sell, but under the 8 a hit needs
      const { s, pool } = crowded([2.2, 2.2, 2.2]);
      const v = computeVerdicts(input({ squad: s, pool, freeTransfers: 1 }));
      expect(v.filter((x) => x.verdict === "sell")).toHaveLength(1);
      const demoted = v.filter((x) => x.reason.endsWith("Other transfers come first"));
      expect(demoted).toHaveLength(2);
      expect(demoted.every((x) => x.verdict === "watch")).toBe(true);
    });

    it("allows one hit, flagged, when the gain clears it", () => {
      const { s, pool } = crowded([6, 6, 6]);
      const v = computeVerdicts(input({ squad: s, pool, freeTransfers: 1 }));
      const sells = v.filter((x) => x.verdict === "sell");
      expect(sells).toHaveLength(1 + VERDICT_RULES.maxHits);
      expect(sells.filter((x) => x.needsHit)).toHaveLength(1);
    });

    it("never offers the same replacement to two sells", () => {
      const { s, pool } = crowded([6, 6, 6]);
      const v = computeVerdicts(input({ squad: s, pool, freeTransfers: 3 }));
      const firsts = v.filter((x) => x.verdict === "sell").map((x) => x.replacements[0].player.id);
      expect(firsts).toHaveLength(3);
      expect(new Set(firsts).size).toBe(3);
    });

    it("with no free transfers, only a move worth a hit is a sell", () => {
      const { s, pool } = crowded([2.2]);
      const v = computeVerdicts(input({ squad: s, pool, freeTransfers: 0 }));
      expect(v.some((x) => x.verdict === "sell")).toBe(false);
    });

    it("does not spend money freed by one sale on the next", () => {
      const s = squad();
      // An injured £9.0m forward goes first and frees £4.0m by moving to a £5.0m one.
      const fwd = s.find((p) => p.posId === 4)!;
      const injured = copy(fwd, {
        cost: 9,
        status: "i",
        fixtures: [0, 1, 2, 3, 4].map((i) => fixtureChip(NEXT + i, { xMins: 0, xPts: 0 })),
      });
      s[s.indexOf(fwd)] = injured;
      const mid = s.find((p) => p.posId === 3)!;
      const weakMid = copy(mid, { cost: 5, perGame: 0.5 });
      s[s.indexOf(mid)] = weakMid;
      const cheapFwd = row({ posId: 4, teamId: 20, cost: 5, perGame: 4 });
      // Only affordable for the midfielder if the forward's £4.0m were spent on him.
      const dearMid = row({ posId: 3, teamId: 21, cost: 8, perGame: 9 });
      const cheapMid = row({ posId: 3, teamId: 22, cost: 5, perGame: 3 });
      const v = computeVerdicts(
        input({ squad: s, pool: [...s, cheapFwd, dearMid, cheapMid], freeTransfers: 2 }),
      );
      expect(v.find((x) => x.player.id === injured.id)!.replacements[0].player.id).toBe(cheapFwd.id);
      const forMid = v.find((x) => x.player.id === weakMid.id)!;
      expect(forMid.replacements.map((r) => r.player.id)).toEqual([cheapMid.id]);
    });
  });
});

describe("bestSwapFor", () => {
  it("picks the squad player the candidate improves on most", () => {
    const s = squad();
    const target = s.find((p) => p.posId === 2)!;
    s[s.indexOf(target)] = copy(target, { perGame: 1 });
    const cand = row({ posId: 2, teamId: 9, cost: 5, perGame: 4 });
    const swap = bestSwapFor(cand, input({ squad: s }));
    expect(swap?.replaces.id).toBe(target.id);
    expect(swap!.gain).toBeGreaterThan(0);
  });

  it("is null when the candidate is unaffordable for every player in the position", () => {
    const s = squad(4, 5);
    const cand = row({ posId: 2, teamId: 9, cost: 9 });
    expect(bestSwapFor(cand, input({ squad: s, bank: 1 }))).toBeNull();
  });
});

describe("suggestTransfers", () => {
  it("lists affordable upgrades, best first, never owned players", () => {
    const s = squad(2);
    const pool = [
      ...s,
      row({ posId: 3, teamId: 9, cost: 5, perGame: 4 }),
      row({ posId: 4, teamId: 8, cost: 5, perGame: 5 }),
    ];
    const out = suggestTransfers(input({ squad: s, pool }));
    expect(out.map((x) => x.player.posId)).toEqual([4, 3]);
    expect(out.every((x) => !s.some((p) => p.id === x.player.id))).toBe(true);
  });

  it("suggests at most two replacements for the same squad player", () => {
    const s = squad(4);
    const gk = s.find((p) => p.posId === 1)!;
    s[s.indexOf(gk)] = copy(gk, { perGame: 0 });
    const keepers = [1, 2, 3, 4].map((i) => row({ posId: 1, teamId: 10 + i, cost: 5, perGame: 4 + i / 10 }));
    const out = suggestTransfers(input({ squad: s, pool: [...s, ...keepers] }));
    expect(out.filter((x) => x.replaces.id === gk.id)).toHaveLength(2);
  });

  it("leaves out injured players and gains under 2", () => {
    const s = squad(4);
    const pool = [
      ...s,
      row({ posId: 3, teamId: 9, cost: 5, perGame: 4.3 }),
      row({
        posId: 3,
        teamId: 9,
        cost: 5,
        perGame: 9,
        fixtures: [fixtureChip(NEXT, { xMins: 0, xPts: 0 }), fixtureChip(NEXT + 1, { xPts: 9 })],
      }),
    ];
    expect(suggestTransfers(input({ squad: s, pool }))).toHaveLength(0);
  });
});
