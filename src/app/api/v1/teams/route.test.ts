import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: null as null | { userId: string; supabase: unknown } }));
const teams = vi.hoisted(() => {
  class TeamNotFound extends Error {}
  return {
    TeamNotFound,
    listTeams: vi.fn(async () => ({ active: 1, teams: [] })),
    addTeam: vi.fn(async () => ({})),
    switchTeam: vi.fn(async () => {}),
    removeTeam: vi.fn(async () => ({ active: null, teams: [] })),
  };
});

vi.mock("@/lib/supabase/server", () => ({ getRequestAuth: vi.fn(async () => auth.value) }));
vi.mock("@/lib/supabase/teams", () => teams);

import { DELETE, GET, POST, PUT } from "./route";

const req = (method: string, body?: unknown, q = "") =>
  new Request(`http://t/api/v1/teams${q}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => {
  auth.value = { userId: "u1", supabase: {} };
  for (const f of [teams.listTeams, teams.addTeam, teams.switchTeam, teams.removeTeam]) f.mockClear();
});

describe("/api/v1/teams", () => {
  it("answers 401 to every method without a session or token", async () => {
    auth.value = null;
    for (const r of [GET(req("GET")), POST(req("POST", { entryId: 1 })), PUT(req("PUT", { entryId: 1 })), DELETE(req("DELETE", undefined, "?entryId=1"))]) {
      expect((await r).status).toBe(401);
    }
    expect(teams.addTeam).not.toHaveBeenCalled();
  });

  it("lists the saved teams", async () => {
    expect(await (await GET(req("GET"))).json()).toEqual({ active: 1, teams: [] });
  });

  it("adds, switches and removes by FPL team ID", async () => {
    expect((await POST(req("POST", { entryId: 5 }))).status).toBe(200);
    expect(teams.addTeam).toHaveBeenCalledWith({}, "u1", 5);
    expect((await PUT(req("PUT", { entryId: 6 }))).status).toBe(200);
    expect(teams.switchTeam).toHaveBeenCalledWith({}, "u1", 6);
    expect((await DELETE(req("DELETE", undefined, "?entryId=7"))).status).toBe(200);
    expect(teams.removeTeam).toHaveBeenCalledWith({}, "u1", 7);
  });

  it("rejects an ID that is not a positive whole number", async () => {
    expect((await POST(req("POST", { entryId: "x" }))).status).toBe(400);
    expect((await PUT(req("PUT", { entryId: 0 }))).status).toBe(400);
    expect((await DELETE(req("DELETE"))).status).toBe(400);
  });

  it("answers 404 for a team FPL does not have, or one not saved", async () => {
    teams.addTeam.mockRejectedValueOnce(new teams.TeamNotFound("No FPL team found for ID 9"));
    const res = await POST(req("POST", { entryId: 9 }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "No FPL team found for ID 9" });
    teams.switchTeam.mockRejectedValueOnce(new teams.TeamNotFound("not saved"));
    expect((await PUT(req("PUT", { entryId: 9 }))).status).toBe(404);
  });
});
