import { beforeEach, describe, expect, it, vi } from "vitest";

const exchange = vi.hoisted(() => ({ error: null as null | { message: string }, code: "" }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: async (code: string) => {
        exchange.code = code;
        return { error: exchange.error };
      },
    },
  }),
}));

import { NextRequest } from "next/server";
import { GET } from "./route";

const call = (q: string) => GET(new NextRequest(`http://localhost/auth/callback${q}`));

beforeEach(() => {
  exchange.error = null;
  exchange.code = "";
});

describe("GET /auth/callback", () => {
  it("exchanges the code and goes to the requested page", async () => {
    const res = await call("?code=abc&next=/watchlist");
    expect(exchange.code).toBe("abc");
    expect(res.headers.get("location")).toBe("http://localhost/watchlist");
  });

  it("defaults to My Squad", async () => {
    expect((await call("?code=abc")).headers.get("location")).toBe("http://localhost/squad");
  });

  it("refuses to redirect off-site", async () => {
    expect((await call("?code=abc&next=//evil.example")).headers.get("location")).toBe(
      "http://localhost/squad",
    );
    expect((await call("?code=abc&next=https://evil.example")).headers.get("location")).toBe(
      "http://localhost/squad",
    );
  });

  it("shows provider and exchange errors on the login page", async () => {
    expect((await call("?error=access_denied")).headers.get("location")).toBe(
      "http://localhost/login?auth_error=access_denied",
    );
    exchange.error = { message: "bad code" };
    expect((await call("?code=x")).headers.get("location")).toBe(
      "http://localhost/login?auth_error=bad%20code",
    );
  });
});
