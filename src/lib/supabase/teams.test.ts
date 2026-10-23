import { beforeEach, describe, expect, it, vi } from "vitest";

const fpl = vi.hoisted(() => ({
  getEntry: vi.fn(async (id: number) => {
    if (id === 404) throw new Error("not found");
    return { name: `Team ${id} FC`, player_first_name: "Sam", player_last_name: "P" };
  }),
}));
vi.mock("@/lib/fpl/client", () => fpl);

import { addTeam, listTeams, removeTeam, switchTeam, TeamNotFound } from "./teams";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

/**
 * Just enough of supabase-js for these queries, over in-memory tables. One user's rows only,
 * as row level security would leave them.
 */
function fakeDb(tables: { profiles: Row[]; saved_teams: Row[] }) {
  let clock = 0;
  const from = (name: "profiles" | "saved_teams") => {
    const filters: [string, unknown][] = [];
    const rows = () => tables[name].filter((r) => filters.every(([k, v]) => r[k] === v));
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => {
        filters.push([k, v]);
        return q;
      },
      order: (k: string) =>
        Promise.resolve({ data: [...rows()].sort((a, b) => Number(a[k]) - Number(b[k])), error: null }),
      maybeSingle: async () => ({ data: rows()[0] ?? null }),
      upsert: async (row: Row, { onConflict }: { onConflict: string }) => {
        const keys = onConflict.split(",");
        const existing = tables[name].find((r) => keys.every((k) => r[k] === row[k]));
        if (existing) Object.assign(existing, row);
        else tables[name].push({ created_at: ++clock, ...row });
        return { error: null };
      },
      delete: () => ({
        eq: async (k: string, v: unknown) => {
          tables[name] = tables[name].filter((r) => r[k] !== v);
          return { error: null };
        },
      }),
    };
    return q;
  };
  return { from } as unknown as SupabaseClient;
}

let tables: { profiles: Row[]; saved_teams: Row[] };
let db: SupabaseClient;
beforeEach(() => {
  tables = { profiles: [], saved_teams: [] };
  db = fakeDb(tables);
  fpl.getEntry.mockClear();
});

describe("saved teams", () => {
  it("adds a team under its FPL name and shows it", async () => {
    const team = await addTeam(db, "u1", 11);
    expect(team).toEqual({ entryId: 11, name: "Team 11 FC", managerName: "Sam P" });
    expect(await listTeams(db, "u1")).toEqual({ active: 11, teams: [team] });
  });

  it("refuses a team FPL does not have, and saves nothing", async () => {
    await expect(addTeam(db, "u1", 404)).rejects.toBeInstanceOf(TeamNotFound);
    expect(tables.saved_teams).toEqual([]);
    expect(tables.profiles).toEqual([]);
  });

  it("keeps every team added, in the order they were added, showing the latest", async () => {
    await addTeam(db, "u1", 11);
    await addTeam(db, "u1", 22);
    const view = await listTeams(db, "u1");
    expect(view.active).toBe(22);
    expect(view.teams.map((t) => t.entryId)).toEqual([11, 22]);
  });

  it("adding a team twice keeps one copy", async () => {
    await addTeam(db, "u1", 11);
    await addTeam(db, "u1", 11);
    expect(tables.saved_teams).toHaveLength(1);
  });

  it("switches only to a saved team", async () => {
    await addTeam(db, "u1", 11);
    await addTeam(db, "u1", 22);
    await switchTeam(db, "u1", 11);
    expect((await listTeams(db, "u1")).active).toBe(11);
    await expect(switchTeam(db, "u1", 33)).rejects.toBeInstanceOf(TeamNotFound);
    expect((await listTeams(db, "u1")).active).toBe(11);
  });

  it("removing the team on show moves to the earliest remaining one", async () => {
    await addTeam(db, "u1", 11);
    await addTeam(db, "u1", 22);
    await addTeam(db, "u1", 33);
    const view = await removeTeam(db, "u1", 33);
    expect(view.active).toBe(11);
    expect(view.teams.map((t) => t.entryId)).toEqual([11, 22]);
  });

  it("removing another team leaves the one on show alone", async () => {
    await addTeam(db, "u1", 11);
    await addTeam(db, "u1", 22);
    expect((await removeTeam(db, "u1", 11)).active).toBe(22);
  });

  it("removing the last team leaves nothing on show", async () => {
    await addTeam(db, "u1", 11);
    expect(await removeTeam(db, "u1", 11)).toEqual({ active: null, teams: [] });
  });

  it("carries over a team saved before saved teams existed, without asking again", async () => {
    tables.profiles.push({ id: "u1", fpl_entry_id: 77 });
    const view = await listTeams(db, "u1");
    expect(view).toEqual({ active: 77, teams: [{ entryId: 77, name: "Team 77 FC", managerName: "Sam P" }] });
    expect(tables.saved_teams).toHaveLength(1);
  });

  it("still lists that team if FPL cannot be reached, just without its name", async () => {
    tables.profiles.push({ id: "u1", fpl_entry_id: 404 });
    expect((await listTeams(db, "u1")).teams).toEqual([{ entryId: 404, name: "Team 404", managerName: null }]);
  });
});
