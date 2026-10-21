import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const claims = vi.hoisted(() => ({
  cookie: null as null | { sub: string; email?: string },
  token: null as null | { sub: string; email?: string },
  tokenSeen: "" as string,
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getClaims: async () => ({ data: claims.cookie ? { claims: claims.cookie } : null, error: null }) },
  }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getClaims: async (jwt: string) => {
        claims.tokenSeen = jwt;
        return claims.token
          ? { data: { claims: claims.token }, error: null }
          : { data: null, error: new Error("invalid JWT") };
      },
    },
  }),
}));

import { getRequestAuth, getUserId } from "./server";

beforeEach(() => {
  vi.stubEnv("ALLOWED_EMAILS", "ok@example.com");
  claims.cookie = null;
  claims.token = null;
});
afterEach(() => vi.unstubAllEnvs());

const req = (headers: Record<string, string> = {}) => new Request("http://t/", { headers });

describe("getUserId", () => {
  it("returns the user for an allowed session", async () => {
    claims.cookie = { sub: "u1", email: "ok@example.com" };
    expect(await getUserId()).toBe("u1");
  });

  it("refuses a valid session that is not on the allow-list", async () => {
    claims.cookie = { sub: "u2", email: "stranger@example.com" };
    expect(await getUserId()).toBeNull();
  });

  it("returns null without a session", async () => {
    expect(await getUserId()).toBeNull();
  });
});

describe("getRequestAuth", () => {
  it("uses the cookie session when there is no bearer token", async () => {
    claims.cookie = { sub: "u1", email: "ok@example.com" };
    expect((await getRequestAuth(req()))?.userId).toBe("u1");
  });

  it("verifies a bearer token and returns its user", async () => {
    claims.token = { sub: "app-user", email: "ok@example.com" };
    const auth = await getRequestAuth(req({ authorization: "Bearer abc.def.ghi" }));
    expect(auth?.userId).toBe("app-user");
    expect(claims.tokenSeen).toBe("abc.def.ghi");
  });

  it("refuses a bearer token for an account not on the allow-list", async () => {
    claims.token = { sub: "app-user", email: "stranger@example.com" };
    expect(await getRequestAuth(req({ authorization: "Bearer abc" }))).toBeNull();
  });

  it("refuses an invalid token, even with a valid cookie alongside it", async () => {
    claims.cookie = { sub: "u1", email: "ok@example.com" };
    expect(await getRequestAuth(req({ authorization: "Bearer forged" }))).toBeNull();
  });
});
