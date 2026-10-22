import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: null as null | { userId: string; supabase: unknown } }));
const app = vi.hoisted(() => ({
  browsePlayers: vi.fn(async () => ({ players: [], total: 0, teams: [] })),
  parseBrowseQuery: vi.fn((p: URLSearchParams) => ({ q: p.get("q") ?? "" })),
}));

vi.mock("@/lib/supabase/server", () => ({ getRequestAuth: vi.fn(async () => auth.value) }));
vi.mock("@/lib/app/players", () => app);

import { GET } from "./route";

beforeEach(() => {
  auth.value = { userId: "u1", supabase: {} };
  app.browsePlayers.mockClear();
});

describe("GET /api/v1/players", () => {
  it("answers 401 without a session or token", async () => {
    auth.value = null;
    expect((await GET(new Request("http://t/api/v1/players"))).status).toBe(401);
    expect(app.browsePlayers).not.toHaveBeenCalled();
  });

  it("passes the URL's filters through", async () => {
    const res = await GET(new Request("http://t/api/v1/players?q=saka"));
    expect(res.status).toBe(200);
    expect(app.browsePlayers).toHaveBeenCalledWith({ q: "saka" });
  });
});
