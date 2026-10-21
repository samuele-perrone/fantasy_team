import { beforeEach, describe, expect, it, vi } from "vitest";

const user = vi.hoisted(() => ({ id: "u1" as string | null }));
const db = vi.hoisted(() => ({ upserts: [] as unknown[], saved: 99 as number | null }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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

  it("saves a valid id against the signed-in user", async () => {
    expect(await saveEntryId(1234)).toEqual({ ok: true });
    expect(db.upserts).toEqual([{ id: "u1", fpl_entry_id: 1234 }]);
  });

  it("rejects invalid ids and signed-out callers without writing", async () => {
    expect((await saveEntryId(0)).ok).toBe(false);
    expect((await saveEntryId(1.5)).ok).toBe(false);
    user.id = null;
    expect((await saveEntryId(1234)).ok).toBe(false);
    expect(db.upserts).toEqual([]);
  });
});
