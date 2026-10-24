import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: null as null | { userId: string; supabase: unknown } }));
const app = vi.hoisted(() => ({ getMatchday: vi.fn(async () => ({ event: 8 })) }));

vi.mock("@/lib/supabase/server", () => ({ getRequestAuth: vi.fn(async () => auth.value) }));
vi.mock("@/lib/supabase/watchlist", () => ({ listWatchlist: vi.fn(async () => [201]) }));
vi.mock("@/lib/app/matches", () => app);

import { GET } from "./route";

/** A Supabase stand-in whose profile lookup returns the given saved team id. */
function supabaseWith(savedId: number | null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: savedId ? { fpl_entry_id: savedId } : null }),
  };
  return { from: () => chain };
}

const get = (q = "") => GET(new Request(`http://test/api/v1/matches${q}`));

beforeEach(() => {
  auth.value = { userId: "u1", supabase: supabaseWith(42) };
  app.getMatchday.mockClear();
});

describe("GET /api/v1/matches", () => {
  it("answers signed out with the same matches and nothing highlighted", async () => {
    auth.value = null;
    const res = await get("?gw=8");
    expect(res.status).toBe(200);
    expect(app.getMatchday).toHaveBeenCalledWith(8, { entryId: null, watchIds: [] });
  });

  it("rejects a gameweek that is not a positive whole number", async () => {
    for (const q of ["?gw=0", "?gw=-1", "?gw=2.5", "?gw=abc"]) {
      expect((await get(q)).status).toBe(400);
    }
    expect(app.getMatchday).not.toHaveBeenCalled();
  });

  it("passes the gameweek, saved team and watchlist through", async () => {
    const res = await get("?gw=8");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ event: 8 });
    expect(app.getMatchday).toHaveBeenCalledWith(8, { entryId: 42, watchIds: [201] });
  });

  it("leaves the gameweek to the default when none is given", async () => {
    auth.value = { userId: "u1", supabase: supabaseWith(null) };
    await get();
    expect(app.getMatchday).toHaveBeenCalledWith(null, { entryId: null, watchIds: [201] });
  });

  it("highlights a team named by ?entry= without a session, and rejects a bad one", async () => {
    auth.value = null;
    expect((await get("?gw=8&entry=849650")).status).toBe(200);
    expect(app.getMatchday).toHaveBeenCalledWith(8, { entryId: 849650, watchIds: [] });
    expect((await get("?entry=abc")).status).toBe(400);
  });
});
