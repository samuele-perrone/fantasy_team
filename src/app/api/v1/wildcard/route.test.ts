import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: null as null | { userId: string; supabase: unknown } }));
const view = vi.hoisted(() => ({ getWildcardView: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ getRequestAuth: vi.fn(async () => auth.value) }));
vi.mock("@/lib/app/squad", () => view);
vi.mock("@/lib/supabase/watchlist", () => ({ listWatchlist: vi.fn(async () => [11, 12]) }));

import { EntryNotFound } from "@/lib/fpl/entry";
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

const get = (q = "") => GET(new Request(`http://test/api/v1/wildcard${q}`));

beforeEach(() => {
  auth.value = { userId: "u1", supabase: supabaseWith(null) };
  view.getWildcardView.mockReset();
});

describe("GET /api/v1/wildcard", () => {
  it("answers 401 signed out with no team ID, as there is no saved team to fall back on", async () => {
    auth.value = null;
    expect((await get()).status).toBe(401);
    expect(view.getWildcardView).not.toHaveBeenCalled();
  });

  it("answers signed out for a team named by ID, as the website does", async () => {
    auth.value = null;
    view.getWildcardView.mockResolvedValue({ ok: true });
    expect((await get("?id=7")).status).toBe(200);
    expect(view.getWildcardView).toHaveBeenCalledWith(7, []);
  });

  it("answers 400 with no id and nothing saved", async () => {
    expect((await get()).status).toBe(400);
  });

  it("rejects an id that is not a positive integer", async () => {
    expect((await get("?id=abc")).status).toBe(400);
    expect((await get("?id=-4")).status).toBe(400);
  });

  it("falls back to the team id saved on the profile", async () => {
    auth.value = { userId: "u1", supabase: supabaseWith(77) };
    view.getWildcardView.mockResolvedValue({ team: { entryId: 77 } });
    const res = await get();
    expect(res.status).toBe(200);
    expect(view.getWildcardView).toHaveBeenCalledWith(77, []);
  });

  it("returns the view as JSON", async () => {
    view.getWildcardView.mockResolvedValue({ team: { entryId: 5 }, verdicts: [], suggestions: [] });
    const res = await get("?id=5");
    expect(await res.json()).toEqual({ team: { entryId: 5 }, verdicts: [], suggestions: [] });
  });

  it("answers 404 for an unknown team", async () => {
    view.getWildcardView.mockRejectedValue(new EntryNotFound("No FPL squad found for ID 9"));
    const res = await get("?id=9");
    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain("No FPL squad");
  });

  it("builds around the caller's watchlist with watch=1", async () => {
    view.getWildcardView.mockResolvedValue({ ok: true });
    expect((await get("?id=5&watch=1")).status).toBe(200);
    expect(view.getWildcardView).toHaveBeenCalledWith(5, [11, 12]);
  });

  it("ignores watch=1 signed out, where there is no watchlist", async () => {
    auth.value = null;
    view.getWildcardView.mockResolvedValue({ ok: true });
    expect((await get("?id=5&watch=1")).status).toBe(200);
    expect(view.getWildcardView).toHaveBeenCalledWith(5, []);
  });
});
