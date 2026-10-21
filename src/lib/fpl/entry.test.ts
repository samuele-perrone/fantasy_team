import { describe, expect, it } from "vitest";
import { estimateFreeTransfers } from "./entry";

const gw = (event: number, event_transfers = 0) => ({ event, event_transfers });

describe("estimateFreeTransfers", () => {
  it("starts at one", () => {
    expect(estimateFreeTransfers([])).toBe(1);
    expect(estimateFreeTransfers([gw(1, 10)])).toBe(1);
  });

  it("does not let gameweek one's unlimited transfers roll over", () => {
    expect(estimateFreeTransfers([gw(1, 0), gw(2, 0)])).toBe(2);
  });

  it("rolls unused transfers up to five", () => {
    expect(estimateFreeTransfers([1, 2, 3, 4, 5, 6, 7, 8].map((e) => gw(e)))).toBe(5);
  });

  it("spends them, never dropping below one", () => {
    expect(estimateFreeTransfers([gw(1), gw(2), gw(3), gw(4, 2)])).toBe(2);
    expect(estimateFreeTransfers([gw(1), gw(2, 3)])).toBe(1);
  });
});
