import { beforeEach, describe, expect, it, vi } from "vitest";

const user = vi.hoisted(() => ({ id: "u1" as string | null }));
const db = vi.hoisted(() => ({ upserts: [] as unknown[], saved: 99 as number | null }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const teams = vi.hoisted(() => {
  class TeamNotFound extends Error {}
  return { TeamNotFound, addTeam: vi.fn(async () => ({})) };
});
vi.mock("./teams", () => teams);
vi.mock("./server", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: db.saved ? { fpl_entry_id: db.saved } : null }),
    upsert: async (row: unknown) => {
      db.upserts.push(row);
      return { error: null };
    },
  };
  return { getUserId: async () => user.id, createClient: async () => ({ from: () => chain }) };
});

import { getSavedEntryId, saveEntryId } from "./profile";

beforeEach(() => {
  teams.addTeam.mockClear();
  user.id = "u1";
  db.upserts = [];
  db.saved = 99;
});

describe("profile", () => {
  it("reads the saved team id, or null signed out", async () => {
    expect(await getSavedEntryId()).toBe(99);
    user.id = null;
    expect(await getSavedEntryId()).toBeNull();
  });

  it("saves a valid id as a saved team for the signed-in user", async () => {
    expect(await saveEntryId(1234)).toEqual({ ok: true });
    expect(teams.addTeam).toHaveBeenCalledWith(expect.anything(), "u1", 1234);
  });

  it("reports a team FPL does not have", async () => {
    teams.addTeam.mockRejectedValueOnce(new teams.TeamNotFound("No FPL team found for ID 9"));
    expect(await saveEntryId(9)).toEqual({ ok: false, error: "No FPL team found for ID 9" });
  });

  it("rejects invalid ids and signed-out callers without writing", async () => {
    expect((await saveEntryId(0)).ok).toBe(false);
    expect((await saveEntryId(1.5)).ok).toBe(false);
    user.id = null;
    expect((await saveEntryId(1234)).ok).toBe(false);
    expect(teams.addTeam).not.toHaveBeenCalled();
  });
});
