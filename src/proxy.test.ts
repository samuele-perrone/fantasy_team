import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const session = vi.hoisted(() => ({
  claims: null as null | { sub: string; email: string },
  refreshCookie: false,
  signedOut: false,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, opts: { cookies: { setAll: (c: unknown[]) => void } }) => ({
    auth: {
      getClaims: async () => {
        // A real refresh writes new cookies during getClaims.
        if (session.refreshCookie) opts.cookies.setAll([{ name: "sb-token", value: "fresh", options: {} }]);
        return { data: session.claims ? { claims: session.claims } : null };
      },
      signOut: async () => {
        session.signedOut = true;
      },
    },
  }),
}));

import { proxy } from "./proxy";

const visit = (path: string) => proxy(new NextRequest(`http://localhost${path}`));
const location = (res: Response) => res.headers.get("location");

beforeEach(() => {
  vi.stubEnv("ALLOWED_EMAILS", "ok@example.com");
  session.claims = null;
  session.refreshCookie = false;
  session.signedOut = false;
});
afterEach(() => vi.unstubAllEnvs());

describe("proxy", () => {
  it("sends a signed-out visitor to /login, remembering where they were going", async () => {
    const res = await visit("/account?tab=x");
    expect(res.status).toBe(307);
    expect(location(res)).toBe("http://localhost/login?next=%2Faccount%3Ftab%3Dx");
  });

  it("lets public paths through signed out", async () => {
    for (const path of [
      "/login",
      "/auth/callback",
      "/apple-icon",
      "/api/v1/squad",
      "/",
      "/matches",
      "/squad?id=1",
      "/players/430",
      "/watchlist",
      "/privacy",
    ]) {
      expect((await visit(path)).headers.get("location"), path).toBeNull();
    }
  });

  it("does not treat a path that merely starts like a public one as public", async () => {
    expect((await visit("/loginx")).status).toBe(307);
    // "/" is public as the home page only, not as a prefix of every path
    expect((await visit("/accountx")).status).toBe(307);
  });

  it("lets an allowed user through", async () => {
    session.claims = { sub: "u1", email: "ok@example.com" };
    expect(location(await visit("/squad"))).toBeNull();
  });

  it("signs out a session that is not on the allow-list", async () => {
    session.claims = { sub: "u2", email: "stranger@example.com" };
    const res = await visit("/squad");
    expect(session.signedOut).toBe(true);
    expect(location(res)).toBe("http://localhost/login?denied=stranger%40example.com");
  });

  it("copies refreshed session cookies onto a redirect", async () => {
    session.claims = { sub: "u1", email: "ok@example.com" };
    session.refreshCookie = true;
    const res = await visit("/login?next=/watchlist");
    expect(location(res)).toBe("http://localhost/watchlist");
    expect(res.headers.get("set-cookie")).toContain("sb-token=fresh");
  });

  it("never bounces a signed-in user to another site", async () => {
    session.claims = { sub: "u1", email: "ok@example.com" };
    expect(location(await visit("/login?next=//evil.example"))).toBe("http://localhost/");
  });
});
