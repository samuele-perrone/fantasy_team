import { describe, expect, it, vi } from "vitest";
import { row } from "@/test/factories";

vi.mock("@/lib/fpl/data", () => ({ getPlayerRows: vi.fn(), getGameData: vi.fn() }));

import { filterPlayers, PAGE_SIZE, parseBrowseQuery, type BrowseQuery } from "./players";

const base: BrowseQuery = { q: "", pos: null, team: null, maxPrice: null, sort: "points5", limit: PAGE_SIZE };

describe("parseBrowseQuery", () => {
  it("reads every filter", () => {
    expect(parseBrowseQuery({ q: " saka ", pos: "mid", team: "1", max: "7.5", sort: "form", n: "60" })).toEqual({
      q: "saka", pos: 3, team: 1, maxPrice: 7.5, sort: "form", limit: 60,
    });
  });

  it("falls back to defaults for anything malformed, rather than showing nothing", () => {
    expect(parseBrowseQuery({ pos: "striker", team: "-2", max: "cheap", sort: "toString", n: "0" })).toEqual(base);
  });

  it("caps how many players one request can ask for", () => {
    expect(parseBrowseQuery({ n: "100000" }).limit).toBe(300);
  });

  it("reads URLSearchParams the same way, for the API route", () => {
    expect(parseBrowseQuery(new URLSearchParams("pos=GKP&sort=price"))).toMatchObject({ pos: 1, sort: "price" });
  });
});

describe("filterPlayers", () => {
  const players = [
    row({ id: 1, name: "Ødegaard", fullName: "Martin Ødegaard", posId: 3, teamId: 1, cost: 8.5, xPts: 25, form: 3 }),
    row({ id: 2, name: "Saka", fullName: "Bukayo Saka", posId: 3, teamId: 1, cost: 10, xPts: 30, form: 6 }),
    row({ id: 3, name: "Raya", fullName: "David Raya", posId: 1, teamId: 1, cost: 5.5, xPts: 20, form: 4 }),
    row({ id: 4, name: "Salah", fullName: "Mohamed Salah", posId: 3, teamId: 2, cost: 13, xPts: 35, form: 5 }),
    row({ id: 5, name: "Gomez", fullName: "Joe Gomez", posId: 2, teamId: 2, cost: 5, xPts: 20, form: 2 }),
  ];
  const ids = (q: Partial<BrowseQuery>) => filterPlayers(players, { ...base, ...q }).players.map((p) => p.id);

  it("orders by points over the next five by default", () => {
    expect(ids({})).toEqual([4, 2, 1, 3, 5]);
  });

  it("filters by position, club and maximum price together", () => {
    expect(ids({ pos: 3 })).toEqual([4, 2, 1]);
    expect(ids({ team: 1, pos: 3 })).toEqual([2, 1]);
    expect(ids({ maxPrice: 8.5 })).toEqual([1, 3, 5]);
  });

  it("finds names without their accents", () => {
    expect(ids({ q: "odegaard" })).toEqual([1]);
    expect(ids({ q: "mohamed" })).toEqual([4]);
  });

  it("ignores a one-letter search, which would match almost everyone", () => {
    expect(ids({ q: "a" })).toHaveLength(5);
  });

  it("sorts by the chosen number", () => {
    expect(ids({ sort: "form" })).toEqual([2, 4, 3, 1, 5]);
    expect(ids({ sort: "price" })).toEqual([4, 2, 1, 3, 5]);
  });

  it("breaks a tie by points over the next five, not by id", () => {
    const tied = [
      row({ id: 10, cost: 6, xPts: 12 }),
      row({ id: 11, cost: 6, xPts: 18 }),
    ];
    expect(filterPlayers(tied, { ...base, sort: "price" }).players.map((p) => p.id)).toEqual([11, 10]);
  });

  it("counts every match while returning one page", () => {
    const r = filterPlayers(players, { ...base, limit: 2 });
    expect(r.players).toHaveLength(2);
    expect(r.total).toBe(5);
  });
});
