import { describe, expect, it } from "vitest";
import { fixtureChip, row } from "@/test/factories";
import { CLOSE_CALL, pickCaptain } from "./captain";
import type { PlayerRow } from "./row";
import type { PlayerVerdict, Verdict } from "./verdict";

const NEXT = 10;

function v(player: PlayerRow, verdict: Verdict = "keep"): PlayerVerdict {
  return {
    player,
    verdict,
    reason: "",
    score: 0,
    gap: 0,
    outGameweeks: 0,
    replacements: [],
    needsHit: false,
  };
}

describe("pickCaptain", () => {
  it("captains the most expected points next gameweek, and the next as vice", () => {
    const a = row({ name: "A", xPtsNext: 5 });
    const b = row({ name: "B", xPtsNext: 8.04 });
    const c = row({ name: "C", xPtsNext: 6 });
    const pick = pickCaptain([v(a), v(b), v(c)], NEXT)!;
    expect(pick.playerId).toBe(b.id);
    expect(pick.points).toBe(8);
    expect(pick.viceId).toBe(c.id);
    expect(pick.vicePoints).toBe(6);
    expect(pick.close).toBe(false);
  });

  it("does not captain a player it says to sell", () => {
    const sold = row({ xPtsNext: 9 });
    const kept = row({ xPtsNext: 6 });
    expect(pickCaptain([v(sold, "sell"), v(kept)], NEXT)!.playerId).toBe(kept.id);
  });

  it("calls it close inside the model's error, and says who the other option is", () => {
    const a = row({ name: "Saka", xPtsNext: 6.5 });
    const b = row({ name: "Palmer", xPtsNext: 6.5 - CLOSE_CALL + 0.1 });
    const pick = pickCaptain([v(a), v(b)], NEXT)!;
    expect(pick.close).toBe(true);
    expect(pick.reason).toContain("Palmer");
    expect(pickCaptain([v(a), v(row({ xPtsNext: 6.5 - CLOSE_CALL }))], NEXT)!.close).toBe(false);
  });

  it("names both games in a double gameweek", () => {
    const dgw = row({
      xPtsNext: 11,
      fixtures: [
        fixtureChip(NEXT, { opponent: "BOU", isHome: true }),
        fixtureChip(NEXT, { opponent: "LIV", isHome: false }),
        fixtureChip(NEXT + 1, { opponent: "ARS" }),
      ],
    });
    const pick = pickCaptain([v(dgw), v(row({ xPtsNext: 5 }))], NEXT)!;
    expect(pick.reason).toBe("Two games: BOU (h), LIV (a)");
  });

  it("names the one opponent otherwise", () => {
    const p = row({
      xPtsNext: 7,
      fixtures: [fixtureChip(NEXT, { opponent: "BOU", isHome: false })],
    });
    expect(pickCaptain([v(p), v(row({ xPtsNext: 3 }))], NEXT)!.reason).toContain("v BOU (a)");
  });

  it("offers nobody without a game, and has no vice when only one player has one", () => {
    expect(pickCaptain([v(row({ xPtsNext: 0 }))], NEXT)).toBeNull();
    const only = pickCaptain([v(row({ xPtsNext: 4 })), v(row({ xPtsNext: 0 }))], NEXT)!;
    expect(only.viceId).toBeNull();
    expect(only.close).toBe(false);
  });
});
