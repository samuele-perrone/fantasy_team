import { describe, expect, it } from "vitest";
import { element, event, fixture, team } from "@/test/factories";
import {
  buildMatch,
  defaultEvent,
  groupByDay,
  matchStatus,
  provisionalBonus,
  type MatchContext,
} from "./matches";
import type { FplFixture, LiveElement } from "./types";

type Stat = FplFixture["stats"][number];
const s = (identifier: string, h: [number, number][] = [], a: [number, number][] = []): Stat => ({
  identifier,
  h: h.map(([element, value]) => ({ element, value })),
  a: a.map(([element, value]) => ({ element, value })),
});

/** A live entry whose points in `fixtureId` come from the given explain lines. */
function live(id: number, fixtureId: number, lines: [string, number, number][]): LiveElement {
  return {
    id,
    stats: {} as LiveElement["stats"],
    explain: [
      {
        fixture: fixtureId,
        stats: lines.map(([identifier, points, value]) => ({ identifier, points, value })),
      },
    ],
  };
}

const home = element({ id: 101, web_name: "Saka", team: 1 });
const away = element({ id: 201, web_name: "Haaland", team: 2 });
const elsewhere = element({ id: 301, web_name: "Salah", team: 3 });

function ctx(partial: Partial<MatchContext> = {}): MatchContext {
  return {
    teams: new Map([1, 2, 3].map((id) => [id, team(id)])),
    elements: new Map([home, away, elsewhere].map((e) => [e.id, e])),
    live: new Map(),
    squadIds: new Set(),
    watchIds: new Set(),
    ...partial,
  };
}

describe("matchStatus", () => {
  it("is upcoming before kickoff and postponed without a date", () => {
    expect(matchStatus(fixture({ team_h: 1, team_a: 2 }))).toBe("upcoming");
    expect(matchStatus(fixture({ team_h: 1, team_a: 2, kickoff_time: null }))).toBe("postponed");
  });

  it("is finished at the provisional whistle, without waiting for bonus to be confirmed", () => {
    const f = fixture({ team_h: 1, team_a: 2, started: true, finished_provisional: true });
    expect(matchStatus(f)).toBe("finished");
    expect(matchStatus({ ...f, finished_provisional: false })).toBe("live");
  });
});

describe("provisionalBonus", () => {
  const bps = (...values: number[]) => values.map((value, i) => ({ element: i + 1, value }));

  it("gives 3, 2 and 1 to the top three", () => {
    expect(provisionalBonus(bps(40, 30, 20, 10))).toEqual([
      { element: 1, value: 3 },
      { element: 2, value: 2 },
      { element: 3, value: 1 },
    ]);
  });

  it("gives two players tied on top 3 each, and the next 1", () => {
    expect(provisionalBonus(bps(40, 40, 30, 20))).toEqual([
      { element: 1, value: 3 },
      { element: 2, value: 3 },
      { element: 3, value: 1 },
    ]);
  });

  it("gives two tied second 2 each, and nobody 1", () => {
    expect(provisionalBonus(bps(40, 30, 30, 20))).toEqual([
      { element: 1, value: 3 },
      { element: 2, value: 2 },
      { element: 3, value: 2 },
    ]);
  });

  it("gives everyone tied third 1", () => {
    expect(provisionalBonus(bps(40, 30, 20, 20, 20)).map((b) => b.value)).toEqual([3, 2, 1, 1, 1]);
  });
});

describe("buildMatch", () => {
  const played = (partial: Partial<FplFixture> = {}) =>
    fixture({
      id: 7,
      team_h: 1,
      team_a: 2,
      started: true,
      minutes: 63,
      team_h_score: 1,
      team_a_score: 2,
      ...partial,
    });

  it("lists goals by side with names, most first", () => {
    const m = buildMatch(
      played({ stats: [s("goals_scored", [[101, 1]], [[201, 2]])] }),
      ctx(),
    );
    expect(m.goals).toEqual([
      { playerId: 201, name: "Haaland", side: "a", value: 2 },
      { playerId: 101, name: "Saka", side: "h", value: 1 },
    ]);
    expect(m.home.score).toBe(1);
    expect(m.away.score).toBe(2);
  });

  it("works bonus out from BPS until FPL confirms it", () => {
    const m = buildMatch(played({ stats: [s("bps", [[101, 30]], [[201, 50]])] }), ctx());
    expect(m.bonusProvisional).toBe(true);
    expect(m.bonus.map((b) => [b.playerId, b.value, b.side])).toEqual([
      [201, 3, "a"],
      [101, 2, "h"],
    ]);
  });

  it("uses confirmed bonus once FPL publishes it, even if BPS disagrees", () => {
    const m = buildMatch(
      played({ stats: [s("bonus", [[101, 3]]), s("bps", [[101, 30]], [[201, 50]])] }),
      ctx(),
    );
    expect(m.bonusProvisional).toBe(false);
    expect(m.bonus).toEqual([{ playerId: 101, name: "Saka", side: "h", value: 3 }]);
  });

  it("has no bonus and no score before kickoff", () => {
    const m = buildMatch(fixture({ team_h: 1, team_a: 2, stats: [s("bps", [[101, 5]])] }), ctx());
    expect(m.bonus).toEqual([]);
    expect(m.home.score).toBeNull();
  });

  it("highlights squad and watched players at either club, and nobody else", () => {
    const m = buildMatch(
      fixture({ team_h: 1, team_a: 2 }),
      ctx({ squadIds: new Set([101, 301]), watchIds: new Set([201]) }),
    );
    expect(m.players.map((p) => [p.name, p.mine, p.watched, p.points])).toEqual([
      ["Saka", true, false, null],
      ["Haaland", false, true, null],
    ]);
  });

  it("scores a player for this match only, adding bonus from the match", () => {
    const entry = live(101, 7, [
      ["minutes", 2, 63],
      ["goals_scored", 4, 1],
      ["bonus", 3, 3], // already in explain once confirmed; must not count twice
    ]);
    entry.explain.push({ fixture: 99, stats: [{ identifier: "goals_scored", points: 4, value: 1 }] });
    const m = buildMatch(
      played({ stats: [s("bps", [[101, 60]], [[201, 10]])] }),
      ctx({ squadIds: new Set([101]), live: new Map([[101, entry]]) }),
    );
    expect(m.players[0]).toMatchObject({ id: 101, points: 2 + 4 + 3, minutes: 63 });
  });

  it("gives a squad player who did not play 0 points once the match is on", () => {
    const m = buildMatch(played(), ctx({ squadIds: new Set([201]) }));
    expect(m.players[0]).toMatchObject({ points: 0, minutes: 0 });
  });

  it("puts squad players before watched ones, then by points", () => {
    const m = buildMatch(
      played(),
      ctx({
        squadIds: new Set([101]),
        watchIds: new Set([201]),
        live: new Map([[201, live(201, 7, [["goals_scored", 8, 2]])]]),
      }),
    );
    expect(m.players.map((p) => p.id)).toEqual([101, 201]);
  });
});

describe("defaultEvent", () => {
  it("stays on the current gameweek while matches remain", () => {
    expect(defaultEvent([event(7, { is_current: true }), event(8, { is_next: true })])).toBe(7);
  });

  it("moves to the next gameweek once the current one is over", () => {
    expect(
      defaultEvent([event(7, { is_current: true, finished: true }), event(8, { is_next: true })]),
    ).toBe(8);
  });

  it("opens on the first gameweek before the season starts", () => {
    expect(defaultEvent([event(1, { is_next: true }), event(2)])).toBe(1);
  });
});

describe("groupByDay", () => {
  const at = (id: number, kickoff: string | null) =>
    buildMatch(fixture({ id, team_h: 1, team_a: 2, kickoff_time: kickoff }), ctx());

  it("groups by London date in kickoff order, unscheduled last", () => {
    const groups = groupByDay([
      at(3, null),
      at(2, "2030-01-05T17:30:00Z"),
      at(1, "2030-01-05T12:30:00Z"),
      // 00:30 on the 6th in UTC is still the 6th in London in January
      at(4, "2030-01-06T00:30:00Z"),
    ]);
    expect(groups.map((g) => [g.day, g.matches.map((m) => m.id)])).toEqual([
      ["Saturday 5 January", [1, 2]],
      ["Sunday 6 January", [4]],
      ["Date to be confirmed", [3]],
    ]);
  });

  it("uses the London date across midnight in summer time", () => {
    // 23:30 UTC on 1 Sept is 00:30 on the 2nd in London
    expect(groupByDay([at(1, "2030-09-01T23:30:00Z")])[0].day).toBe("Monday 2 September");
  });
});
