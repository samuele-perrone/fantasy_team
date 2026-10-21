import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixture } from "@/test/factories";
import type { FplFixture } from "@/lib/fpl/types";

const state = vi.hoisted(() => ({
  fixtures: [] as FplFixture[],
  picks: new Map<number, number[]>(),
  liveCalls: 0,
}));

vi.mock("@/lib/fpl/data", async () => {
  const f = await import("@/test/factories");
  return {
    getGameData: async () => ({
      events: [
        f.event(7, { is_current: true, finished: true }),
        f.event(8, { is_next: true }),
        f.event(9),
      ],
      currentEvent: f.event(7, { is_current: true }),
      teams: new Map([1, 2].map((id) => [id, f.team(id)])),
      bootstrap: {
        elements: [
          f.element({ id: 101, web_name: "Saka", team: 1 }),
          f.element({ id: 201, web_name: "Haaland", team: 2 }),
        ],
      },
    }),
  };
});
vi.mock("@/lib/fpl/client", () => ({
  getEventFixtures: vi.fn(async (gw: number) => state.fixtures.filter((f) => f.event === gw)),
  getLive: vi.fn(async () => {
    state.liveCalls++;
    return { elements: [] };
  }),
  getEntryPicks: vi.fn(async (_id: number, gw: number) => {
    const ids = state.picks.get(gw);
    if (!ids) throw new Error("no picks");
    return { picks: ids.map((element) => ({ element })) };
  }),
}));

import { getEntryPicks } from "@/lib/fpl/client";
import { getMatchday } from "./matches";

beforeEach(() => {
  state.fixtures = [
    fixture({ id: 1, event: 7, team_h: 1, team_a: 2, started: true, finished_provisional: true }),
    fixture({ id: 2, event: 8, team_h: 2, team_a: 1 }),
  ];
  state.picks = new Map([[7, [101]]]);
  state.liveCalls = 0;
  vi.mocked(getEntryPicks).mockClear();
});

describe("getMatchday", () => {
  it("opens on the next gameweek once the current one is finished", async () => {
    const view = await getMatchday(null, { entryId: null, watchIds: [] });
    expect(view.event).toBe(8);
    expect(view.prev).toBe(7);
    expect(view.next).toBe(9);
  });

  it("ignores a gameweek that does not exist", async () => {
    expect((await getMatchday(99, { entryId: null, watchIds: [] })).event).toBe(8);
  });

  it("has no next link from the last gameweek", async () => {
    expect((await getMatchday(9, { entryId: null, watchIds: [] })).next).toBeNull();
  });

  it("highlights a future gameweek with the latest squad FPL shows", async () => {
    const view = await getMatchday(8, { entryId: 5, watchIds: [201] });
    expect(vi.mocked(getEntryPicks)).toHaveBeenCalledWith(5, 7);
    expect(view.hasSquad).toBe(true);
    const players = view.days[0].matches[0].players;
    expect(players.map((p) => [p.id, p.mine, p.watched])).toEqual([
      [101, true, false],
      [201, false, true],
    ]);
  });

  it("still shows matches when the squad cannot be read", async () => {
    state.picks = new Map();
    const view = await getMatchday(8, { entryId: 5, watchIds: [] });
    expect(view.hasSquad).toBe(false);
    expect(view.days[0].matches).toHaveLength(1);
  });

  it("skips the live endpoint until something has kicked off", async () => {
    await getMatchday(8, { entryId: null, watchIds: [] });
    expect(state.liveCalls).toBe(0);
    await getMatchday(7, { entryId: null, watchIds: [] });
    expect(state.liveCalls).toBe(1);
  });

  it("flags a live match so the page keeps refreshing", async () => {
    expect((await getMatchday(7, { entryId: null, watchIds: [] })).live).toBe(false);
    state.fixtures[0] = { ...state.fixtures[0], finished_provisional: false };
    expect((await getMatchday(7, { entryId: null, watchIds: [] })).live).toBe(true);
  });
});
