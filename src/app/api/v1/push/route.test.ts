import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: null as null | { userId: string; supabase: unknown } }));
const push = vi.hoisted(() => ({ savePushSettings: vi.fn(async () => {}) }));

vi.mock("@/lib/supabase/server", () => ({
  getRequestAuth: vi.fn(async () => auth.value),
  createClient: vi.fn(async () => ({ tag: "anon" })),
}));
vi.mock("@/lib/push", async (orig) => ({ ...(await orig<typeof import("@/lib/push")>()), ...push }));

import { PUT } from "./route";

const valid = {
  token: "A1B2C3D4E5F60718293A4B5C6D7E8F90A1B2C3D4E5F60718293A4B5C6D7E8F90",
  environment: "production",
  enabled: true,
  scope: "mine",
  goals: true,
  redCards: false,
  fullTime: true,
  entryId: 849650,
};
const put = (body: unknown) =>
  PUT(new Request("http://t/api/v1/push", { method: "PUT", body: JSON.stringify(body) }));

beforeEach(() => {
  auth.value = null;
  push.savePushSettings.mockClear();
});

describe("PUT /api/v1/push", () => {
  it("saves a signed-out phone's settings, token lower-cased", async () => {
    expect((await put(valid)).status).toBe(200);
    expect(push.savePushSettings).toHaveBeenCalledWith(
      { tag: "anon" },
      expect.objectContaining({ token: valid.token.toLowerCase(), scope: "mine", redCards: false, entryId: 849650 }),
    );
  });

  it("saves through the signed-in user's own client when there is a session", async () => {
    auth.value = { userId: "u1", supabase: { tag: "user" } };
    await put({ ...valid, entryId: null });
    expect(push.savePushSettings).toHaveBeenCalledWith({ tag: "user" }, expect.objectContaining({ entryId: null }));
  });

  it("refuses anything malformed without saving", async () => {
    for (const bad of [
      null,
      { ...valid, token: "not-hex" },
      { ...valid, environment: "staging" },
      { ...valid, scope: "some" },
      { ...valid, goals: "yes" },
      { ...valid, entryId: -3 },
      { ...valid, fullTime: undefined },
    ]) {
      expect((await put(bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect(push.savePushSettings).not.toHaveBeenCalled();
  });
});
