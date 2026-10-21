import { describe, expect, it } from "vitest";
import { cn, formatKickoff, money, timeAgo } from "./utils";

const NOW = Date.parse("2026-10-20T12:00:00Z");

describe("timeAgo", () => {
  it("says how long ago, in the largest sensible unit", () => {
    expect(timeAgo("2026-10-20T11:59:40Z", NOW)).toBe("just now");
    expect(timeAgo("2026-10-20T11:15:00Z", NOW)).toBe("45 min ago");
    expect(timeAgo("2026-10-20T11:00:00Z", NOW)).toBe("1 hour ago");
    expect(timeAgo("2026-10-20T02:00:00Z", NOW)).toBe("10 hours ago");
    expect(timeAgo("2026-10-16T12:00:00Z", NOW)).toBe("4 days ago");
  });

  it("is null without a usable time", () => {
    expect(timeAgo(null, NOW)).toBeNull();
    expect(timeAgo("not a date", NOW)).toBeNull();
  });
});

describe("formatting", () => {
  it("prints prices to one decimal place", () => {
    expect(money(6)).toBe("£6.0m");
    expect(money(12.45)).toBe("£12.4m");
  });

  it("shows TBC for an unscheduled kickoff and UK time otherwise", () => {
    expect(formatKickoff(null)).toBe("TBC");
    // British Summer Time: 14:00 UTC is 15:00 in London
    expect(formatKickoff("2026-07-25T14:00:00Z")).toContain("15:00");
  });

  it("joins only truthy class names", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});
