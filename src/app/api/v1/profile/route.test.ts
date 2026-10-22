import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: null as null | { userId: string; supabase: unknown } }));
const fpl = vi.hoisted(() => ({ getEntry: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ getRequestAuth: vi.fn(async () => auth.value) }));
vi.mock("@/lib/fpl/client", () => fpl);

import { GET, PUT } from "./route";

/** A Supabase stand-in: profile reads return `saved`, upserts are recorded. */
function supabase(saved: number | null, upsertError: string | null = null) {
  const upserts: unknown[] = [];
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: saved ? { fpl_entry_id: saved } : null }),
    upsert: async (row: unknown) => {
      upserts.push(row);
      return { error: upsertError ? { message: upsertError } : null };
    },
  };
  return { client: { from: () => chain }, upserts };
}

const put = (body: unknown) =>
  PUT(new Request("http://t/api/v1/profile", { method: "PUT", body: JSON.stringify(body) }));

let db: ReturnType<typeof supabase>;
beforeEach(() => {
  db = supabase(42);
  auth.value = { userId: "u1", supabase: db.client };
  fpl.getEntry.mockReset().mockResolvedValue({ id: 1 });
});

describe("/api/v1/profile", () => {
  it("answers 401 without a session or token", async () => {
    auth.value = null;
    expect((await GET(new Request("http://t/api/v1/profile"))).status).toBe(401);
    expect((await put({ entryId: 1 })).status).toBe(401);
  });

  it("returns the saved team ID", async () => {
    expect(await (await GET(new Request("http://t/api/v1/profile"))).json()).toEqual({ entryId: 42 });
  });

  it("saves a team ID FPL knows", async () => {
    const res = await put({ entryId: 849650 });
    expect(res.status).toBe(200);
    expect(db.upserts).toEqual([{ id: "u1", fpl_entry_id: 849650 }]);
  });

  it("rejects an ID that is not a positive whole number, without asking FPL", async () => {
    for (const entryId of [0, -1, 1.5, "abc", null]) {
      expect((await put({ entryId })).status).toBe(400);
    }
    expect(fpl.getEntry).not.toHaveBeenCalled();
  });

  it("does not save an ID FPL has no team for", async () => {
    fpl.getEntry.mockRejectedValue(new Error("404"));
    expect((await put({ entryId: 999 })).status).toBe(404);
    expect(db.upserts).toEqual([]);
  });
});
