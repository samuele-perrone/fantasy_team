import { describe, expect, it } from "vitest";
import { benchCounts, chipLabel, chipNote, chipStatuses } from "./chips";

describe("chips", () => {
  it("names known chips and passes unknown ones through", () => {
    expect(chipLabel("3xc")).toBe("Triple Captain");
    expect(chipLabel("mystery")).toBe("mystery");
    expect(chipLabel(null)).toBeNull();
    expect(chipNote("mystery")).toBeNull();
  });

  it("only counts the bench under Bench Boost", () => {
    expect(benchCounts("bboost")).toBe(true);
    expect(benchCounts("3xc")).toBe(false);
  });

  it("tracks each chip per half-season", () => {
    const s = chipStatuses([{ name: "wildcard", event: 5 }], 8);
    const wc = s.filter((c) => c.key === "wildcard");
    expect(wc).toHaveLength(2);
    expect(wc.find((c) => c.half === 1)).toMatchObject({ usedIn: 5, available: false });
    expect(wc.find((c) => c.half === 2)).toMatchObject({ usedIn: null, available: true });
  });

  it("makes transfer chips unavailable in gameweek one", () => {
    const fh = chipStatuses([], 1).find((c) => c.key === "freehit" && c.half === 1);
    expect(fh?.firstEvent).toBe(2);
  });
});
