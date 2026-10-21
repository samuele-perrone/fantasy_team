import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const user = vi.hoisted(() => ({ id: "u1" as string | null }));
const team = vi.hoisted(() => ({ resolveTeam: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ getUserId: async () => user.id }));
vi.mock("@/lib/fpl/entry", async (orig) => ({
  ...(await orig<typeof import("@/lib/fpl/entry")>()),
  resolveTeam: team.resolveTeam,
}));
vi.mock("@/lib/ai/squad-brief", () => ({ buildSquadBrief: async () => "brief", SYSTEM_PROMPT: "sys" }));
vi.mock("ai", async (orig) => ({
  ...(await orig<typeof import("ai")>()),
  streamText: vi.fn(() => {
    throw new Error("streamText must not be reached in these tests");
  }),
}));

import { POST } from "./route";

const message = (text: string) => ({ id: "m", role: "user", parts: [{ type: "text", text }] });
const ask = (body: unknown) =>
  POST(new Request("http://t/api/ask", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => {
  user.id = "u1";
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
  team.resolveTeam.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/ask", () => {
  it("answers 401 before doing anything that costs money", async () => {
    user.id = null;
    expect((await ask({ messages: [message("hi")], team: "id=1" })).status).toBe(401);
    expect(team.resolveTeam).not.toHaveBeenCalled();
  });

  it("answers 503 when no API key is configured", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect((await ask({ messages: [message("hi")], team: "id=1" })).status).toBe(503);
  });

  it("rejects malformed and empty requests", async () => {
    expect((await ask("{nope")).status).toBe(400);
    expect((await ask({ messages: [], team: "id=1" })).status).toBe(400);
  });

  it("rejects an overlong message", async () => {
    expect((await ask({ messages: [message("x".repeat(2001))], team: "id=1" })).status).toBe(413);
  });

  it("answers 400 when there is no squad to talk about", async () => {
    team.resolveTeam.mockResolvedValue(null);
    expect((await ask({ messages: [message("hi")], team: "" })).status).toBe(400);
  });
});
