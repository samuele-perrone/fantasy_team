import { describe, expect, it, vi } from "vitest";
import { row, squad } from "@/test/factories";
import type { PlayerVerdict } from "@/lib/fpl/verdict";
import { bestXI } from "@/lib/fpl/optimiser";

const s = squad();
const sold = s[7];
const replacement = row({ name: "Upgrade", posId: 3, teamId: 9, cost: 5 });

vi.mock("@/lib/fpl/data", () => ({
  getGameData: async () => ({
    bootstrap: { elements: [] },
    teams: new Map(),
    ctx: { ratings: new Map(), nextEvent: 10 },
  }),
}));
vi.mock("@/lib/app/squad", () => ({
  verdictsFor: async (): Promise<PlayerVerdict[]> =>
    s.map((p) => ({
      player: p,
      verdict: p.id === sold.id ? "sell" : "keep",
      reason: p.id === sold.id ? "Tough run: ARS (a), LIV (a), MCI (h)" : "No clearly better option you can afford",
      score: 10,
      gap: p.id === sold.id ? 9 : 0,
      outGameweeks: 0,
      replacements: p.id === sold.id ? [{ player: replacement, gain: 9.2, reason: "" }] : [],
      needsHit: p.id === sold.id,
    })),
}));

import { buildSquadBrief, SYSTEM_PROMPT } from "./squad-brief";
import type { LoadedTeam } from "@/lib/fpl/entry";

const team = {
  source: "fpl",
  entryId: 1,
  name: "My XI",
  managerName: "Sam P",
  overallPoints: null,
  overallRank: null,
  event: 9,
  picks: [],
  activeChip: null,
  eventTransfersCost: 0,
  squad: s,
  xi: bestXI(s),
  actual: bestXI(s),
  captainId: null,
  viceCaptainId: null,
  bank: 0.5,
  squadValue: 100,
  freeTransfers: 1,
  teamCodes: {},
  pool: s,
  rules: undefined,
  history: null,
} as unknown as LoadedTeam;

describe("buildSquadBrief", () => {
  it("hands the model the verdicts the page shows, with replacements and hits", async () => {
    const brief = await buildSquadBrief(team);
    expect(brief).toContain("VERDICTS SHOWN ON THE PAGE");
    expect(brief).toContain(
      `- ${sold.name}: SELL. Tough run: ARS (a), LIV (a), MCI (h) · best replacements: Upgrade (£5.0m, about 9 more points) · this sale costs a 4-point hit`,
    );
    expect(brief).toContain(`- ${s[0].name}: KEEP. No clearly better option you can afford`);
  });

  it("states the bank and free transfers", async () => {
    expect(await buildSquadBrief(team)).toContain("£0.5m in the bank, 1 free transfer.");
  });

  it("tells the model never to contradict the verdicts or to calculate", () => {
    expect(SYSTEM_PROMPT).toContain("never contradict them");
    expect(SYSTEM_PROMPT).toContain("Never invent a number");
  });
});
