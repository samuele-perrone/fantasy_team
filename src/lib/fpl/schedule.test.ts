import { describe, expect, it } from "vitest";
import { fixture } from "@/test/factories";
import { buildSchedules, isCongested, type OtherMatch } from "./schedule";

// January 2030: Saturday 5th, Tuesday 8th, Saturday 12th, Wednesday 16th.
const sat5 = "2030-01-05T15:00:00Z";
const tue8 = "2030-01-08T20:00:00Z";
const sat12 = "2030-01-12T15:00:00Z";
const sat19 = "2030-01-19T15:00:00Z";

describe("isCongested", () => {
  it("counts Saturday, midweek, Saturday as three in seven days", () => {
    expect(isCongested(sat12, [sat5, tue8, sat12])).toBe(true);
    expect(isCongested(sat5, [sat5, tue8, sat12])).toBe(true);
  });

  it("does not count two games in a week", () => {
    expect(isCongested(sat12, [sat5, sat12, sat19])).toBe(false);
  });

  it("does not stretch to three games across eight days", () => {
    // Saturday 5th to Sunday 13th is eight days
    expect(isCongested(sat5, [sat5, tue8, "2030-01-13T14:00:00Z"])).toBe(false);
  });

  it("compares London dates, so a late kickoff is not pushed into the next day", () => {
    // 23:30 UTC on Saturday 12 Jan is still Saturday in London; seven days after the 5th
    expect(isCongested(sat5, [sat5, tue8, "2030-01-12T23:30:00Z"])).toBe(true);
    // In summer 23:30 UTC is 00:30 the next day in London: Sunday, eight days on
    expect(
      isCongested("2030-08-03T15:00:00Z", ["2030-08-03T15:00:00Z", "2030-08-06T19:00:00Z", "2030-08-10T23:30:00Z"]),
    ).toBe(false);
  });
});

describe("buildSchedules", () => {
  const other = (kickoff: string, teamId = 1): OtherMatch => ({
    id: 1, teamId, kickoff, competition: "Champions League", opponent: "Inter", home: true,
  });
  const league = [
    fixture({ id: 1, team_h: 1, team_a: 2, kickoff_time: sat5 }),
    fixture({ id: 2, team_h: 3, team_a: 1, kickoff_time: sat12 }),
    fixture({ id: 3, team_h: 2, team_a: 3, kickoff_time: sat12 }),
  ];
  const now = Date.parse("2030-01-01T00:00:00Z");

  it("marks a club's league games around its midweek tie, and only that club's", () => {
    const s = buildSchedules(league, [other(tue8)], now);
    expect([...s.get(1)!.congested]).toEqual([1, 2]);
    expect(s.get(2)!.congested.size).toBe(0);
    expect(s.get(3)!.congested.size).toBe(0);
  });

  it("lists only a club's own other matches, dropping ones long finished", () => {
    const s = buildSchedules(league, [other(tue8), other("2029-12-10T20:00:00Z"), other(tue8, 2)], now);
    expect(s.get(1)!.others.map((o) => o.kickoff)).toEqual([tue8]);
    expect(s.get(2)!.others).toHaveLength(1);
  });

  it("counts three league games in a week, as at Christmas", () => {
    const s = buildSchedules(
      [
        fixture({ id: 1, team_h: 1, team_a: 2, kickoff_time: "2030-12-26T15:00:00Z" }),
        fixture({ id: 2, team_h: 3, team_a: 1, kickoff_time: "2030-12-28T15:00:00Z" }),
        fixture({ id: 3, team_h: 1, team_a: 4, kickoff_time: "2031-01-01T15:00:00Z" }),
      ],
      [],
      now,
    );
    expect(s.get(1)!.congested.size).toBe(3);
  });

  it("ignores league fixtures with no date", () => {
    const s = buildSchedules([fixture({ id: 9, team_h: 1, team_a: 2, kickoff_time: null })], [other(tue8)], now);
    expect(s.get(1)).toBeUndefined();
  });
});
