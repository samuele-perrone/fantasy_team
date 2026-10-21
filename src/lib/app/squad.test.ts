import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy, row, squad } from "@/test/factories";
import type { PlayerRow } from "@/lib/fpl/row";

const state = vi.hoisted(() => ({ rows: [] as PlayerRow[], team: null as unknown }));

vi.mock("@/lib/fpl/data", () => ({
  getPlayerRows: async () => state.rows,
  getGameData: async () => ({
    ctx: { nextEvent: 10 },
    events: [{ id: 10, deadline_time: "2030-01-05T11:00:00Z" }],
  }),
}));
vi.mock("@/lib/fpl/entry", () => ({
  loadTeam: vi.fn(async () => {
    if (!state.team) throw new Error("no team");
    return state.team;
  }),
}));

import { getSquadView, getWatchedPlayers, searchPlayers } from "./squad";

function loadedTeam(s: PlayerRow[], pool: PlayerRow[]) {
  return {
    name: "My XI",
    managerName: "Sam",
    event: 9,
    squad: s,
    pool,
    bank: 0.5,
    freeTransfers: 1,
    rules: undefined,
  };
}

beforeEach(() => {
  state.rows = [];
  state.team = null;
});

describe("getSquadView", () => {
  it("lists sells first, then watches, then keeps, by position within each", async () => {
    const s = squad();
    const fwd = s.find((p) => p.posId === 4)!;
    const def = s.find((p) => p.posId === 2)!;
    s[s.indexOf(fwd)] = copy(fwd, { perGame: 0.5 });
    s[s.indexOf(def)] = copy(def, { status: "d", availability: 75, news: "Knock" });
    const upgrade = row({ posId: 4, teamId: 9, cost: 5, perGame: 4 });
    state.team = loadedTeam(s, [...s, upgrade]);

    const view = await getSquadView(123);
    expect(view.team).toMatchObject({ entryId: 123, name: "My XI", nextEvent: 10, bank: 0.5, freeTransfers: 1, deadline: "2030-01-05T11:00:00Z" });
    const order = view.verdicts.map((v) => v.verdict);
    expect(order[0]).toBe("sell");
    expect(order[1]).toBe("watch");
    expect(order.slice(2).every((v) => v === "keep")).toBe(true);
    const keepPositions = view.verdicts.slice(2).map((v) => v.player.posId);
    expect(keepPositions).toEqual([...keepPositions].sort((a, b) => a - b));
    expect(view.suggestions[0].player.id).toBe(upgrade.id);
  });
});

describe("getWatchedPlayers", () => {
  it("returns watched players in the order given, with the swap they would make", async () => {
    const s = squad(2);
    const a = row({ posId: 3, teamId: 9, cost: 5, perGame: 4 });
    const b = row({ posId: 4, teamId: 8, cost: 5, perGame: 4 });
    state.rows = [...s, a, b];
    state.team = loadedTeam(s, state.rows);
    const out = await getWatchedPlayers([b.id, a.id, 999], 1);
    expect(out.map((w) => w.player.id)).toEqual([b.id, a.id]);
    expect(out[0].swap?.replaces.posId).toBe(4);
  });

  it("shows no swap without a squad, or for a player already owned", async () => {
    const s = squad();
    state.rows = s;
    expect((await getWatchedPlayers([s[0].id], null))[0].swap).toBeNull();
    state.team = loadedTeam(s, s);
    expect((await getWatchedPlayers([s[0].id], 1))[0].swap).toBeNull();
  });

  it("is empty for an empty watchlist", async () => {
    expect(await getWatchedPlayers([], 1)).toEqual([]);
  });
});

describe("searchPlayers", () => {
  beforeEach(() => {
    state.rows = [
      row({ name: "Ødegaard", fullName: "Martin Ødegaard", xPts: 20 }),
      row({ name: "Guéhi", fullName: "Marc Guéhi", xPts: 15 }),
      row({ name: "Saka", fullName: "Bukayo Saka", xPts: 30 }),
      row({ name: "Sakala", fullName: "Fashion Sakala", xPts: 5 }),
    ];
  });

  it("ignores accents and case", async () => {
    expect((await searchPlayers("ODEGAARD")).map((p) => p.name)).toEqual(["Ødegaard"]);
    expect((await searchPlayers("guehi")).map((p) => p.name)).toEqual(["Guéhi"]);
  });

  it("matches full names too, best projected first", async () => {
    expect((await searchPlayers("saka")).map((p) => p.name)).toEqual(["Saka", "Sakala"]);
    expect((await searchPlayers("bukayo")).map((p) => p.name)).toEqual(["Saka"]);
  });

  it("needs at least two characters", async () => {
    expect(await searchPlayers("s")).toEqual([]);
    expect(await searchPlayers("  ")).toEqual([]);
  });
});
