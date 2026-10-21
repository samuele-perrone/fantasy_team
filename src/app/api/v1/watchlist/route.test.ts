import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: null as null | { userId: string; supabase: unknown } }));
const store = vi.hoisted(() => ({
  listWatchlist: vi.fn(async () => [3, 4]),
  addToWatchlist: vi.fn(async () => null as string | null),
  removeFromWatchlist: vi.fn(async () => null as string | null),
}));
const view = vi.hoisted(() => ({ getWatchedPlayers: vi.fn(async () => [{ player: { id: 3 } }]) }));

vi.mock("@/lib/supabase/server", () => ({ getRequestAuth: vi.fn(async () => auth.value) }));
vi.mock("@/lib/supabase/watchlist", () => store);
vi.mock("@/lib/app/squad", () => view);

import { DELETE, GET, POST } from "./route";

const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: { fpl_entry_id: 42 } }) };
const supabase = { from: () => chain };

beforeEach(() => {
  auth.value = { userId: "u1", supabase };
  vi.clearAllMocks();
});

describe("/api/v1/watchlist", () => {
  it("answers 401 to every method without auth", async () => {
    auth.value = null;
    expect((await GET(new Request("http://t/"))).status).toBe(401);
    expect((await POST(new Request("http://t/", { method: "POST", body: "{}" }))).status).toBe(401);
    expect((await DELETE(new Request("http://t/?playerId=1"))).status).toBe(401);
    expect(store.addToWatchlist).not.toHaveBeenCalled();
    expect(store.removeFromWatchlist).not.toHaveBeenCalled();
  });

  it("lists watched players against the saved squad", async () => {
    const res = await GET(new Request("http://t/"));
    expect(await res.json()).toEqual({ players: [{ player: { id: 3 } }] });
    expect(view.getWatchedPlayers).toHaveBeenCalledWith([3, 4], 42);
  });

  it("adds a player for the signed-in user", async () => {
    const res = await POST(new Request("http://t/", { method: "POST", body: JSON.stringify({ playerId: 12 }) }));
    expect(res.status).toBe(200);
    expect(store.addToWatchlist).toHaveBeenCalledWith(supabase, "u1", 12);
  });

  it("rejects a bad body", async () => {
    for (const body of ["not json", "{}", JSON.stringify({ playerId: 1.5 }), JSON.stringify({ playerId: -1 })]) {
      expect((await POST(new Request("http://t/", { method: "POST", body }))).status).toBe(400);
    }
    expect(store.addToWatchlist).not.toHaveBeenCalled();
  });

  it("removes a player", async () => {
    expect((await DELETE(new Request("http://t/?playerId=12"))).status).toBe(200);
    expect(store.removeFromWatchlist).toHaveBeenCalledWith(supabase, 12);
    expect((await DELETE(new Request("http://t/"))).status).toBe(400);
  });

  it("reports a database error as 500", async () => {
    store.addToWatchlist.mockResolvedValueOnce("relation does not exist");
    const res = await POST(new Request("http://t/", { method: "POST", body: JSON.stringify({ playerId: 1 }) }));
    expect(res.status).toBe(500);
  });
});
