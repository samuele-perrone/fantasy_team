import { describe, expect, it } from "vitest";
import { message, newEvents, snapshot, wants, type Match, type Matchday } from "./events";

function match(over: Partial<Match> = {}): Match {
  return {
    id: 1,
    status: "live",
    home: { id: 1, name: "Man City", short: "MCI", score: 0 },
    away: { id: 2, name: "Ipswich Town", short: "IPS", score: 0 },
    goals: [],
    assists: [],
    ownGoals: [],
    redCards: [],
    players: [],
    ...over,
  };
}
const day = (matches: Match[], event = 8): Matchday => ({ event, live: true, days: [{ matches }] });
const haaland = { playerId: 10, name: "Haaland", side: "h" as const, value: 1 };
const foden = { playerId: 11, name: "Foden", side: "h" as const, value: 1 };

describe("newEvents", () => {
  it("reports a new goal with the assist that came with it, and the score", () => {
    const before = snapshot(day([match()]));
    const after = day([match({ home: { ...match().home, score: 1 }, goals: [haaland], assists: [foden] })]);
    expect(newEvents(before, after)).toEqual([
      { kind: "goal", matchId: 1, playerId: 10, name: "Haaland", club: "Man City", assist: "Foden", score: "Man City 1–0 Ipswich Town" },
    ]);
  });

  it("reports each extra goal once, and nothing already seen", () => {
    const one = day([match({ goals: [haaland] })]);
    const three = day([match({ goals: [{ ...haaland, value: 3 }] })]);
    expect(newEvents(snapshot(one), three).filter((e) => e.kind === "goal")).toHaveLength(2);
    expect(newEvents(snapshot(three), three)).toEqual([]);
    const ended = day([match({ status: "finished" })]);
    expect(newEvents(snapshot(ended), ended)).toEqual([]);
  });

  it("reports own goals, red cards and the full-time whistle", () => {
    const before = snapshot(day([match()]));
    const after = day([
      match({
        status: "finished",
        ownGoals: [{ playerId: 20, name: "Burgess", side: "a", value: 1 }],
        redCards: [{ playerId: 21, name: "Rodri", side: "h", value: 1 }],
      }),
    ]);
    expect(newEvents(before, after).map((e) => e.kind)).toEqual(["ownGoal", "redCard", "fullTime"]);
  });

  it("sends nothing on the first look, a new gameweek, or a match it had not seen", () => {
    const goal = day([match({ goals: [haaland] })]);
    expect(newEvents(null, goal)).toEqual([]);
    expect(newEvents(snapshot(day([match()], 7)), goal)).toEqual([]);
    expect(newEvents(snapshot(day([match({ id: 2 })])), goal)).toEqual([]);
  });
});

describe("wants", () => {
  const goal = newEvents(snapshot(day([match()])), day([match({ goals: [haaland] })]))[0];
  const all = { scope: "all" as const, goals: true, redCards: true, fullTime: true };

  it("sends only matches with the phone's players when set to mine", () => {
    expect(wants({ ...all, scope: "mine" }, goal, new Set([1]))).toBe(true);
    expect(wants({ ...all, scope: "mine" }, goal, new Set([2]))).toBe(false);
    expect(wants(all, goal, new Set())).toBe(true);
  });

  it("respects each kind of event being switched off", () => {
    expect(wants({ ...all, goals: false }, goal, new Set())).toBe(false);
    const ft = { kind: "fullTime" as const, matchId: 1, score: "" };
    expect(wants({ ...all, fullTime: false }, ft, new Set())).toBe(false);
    expect(wants({ ...all, goals: false }, ft, new Set())).toBe(true);
  });
});

describe("message", () => {
  const goal = { kind: "goal" as const, matchId: 1, playerId: 10, name: "Haaland", club: "Man City", assist: "Foden", score: "Man City 1–0 Ipswich Town" };

  it("says when the scorer is in your squad", () => {
    expect(message(goal, new Set([10])).title).toBe("⚽ Haaland scores for you");
    expect(message(goal, new Set()).title).toBe("⚽ Haaland scores");
    expect(message(goal, new Set()).body).toBe("Man City 1–0 Ipswich Town · assist Foden");
  });
});
