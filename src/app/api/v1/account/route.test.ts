import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: null as null | { userId: string; supabase: unknown } }));
const account = vi.hoisted(() => ({ deleteAccount: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ getRequestAuth: vi.fn(async () => auth.value) }));
vi.mock("@/lib/supabase/account", () => account);

import { DELETE } from "./route";

const del = () => DELETE(new Request("http://test/api/v1/account", { method: "DELETE" }));

beforeEach(() => {
  auth.value = { userId: "u1", supabase: { tag: "client" } };
  account.deleteAccount.mockReset();
});

describe("DELETE /api/v1/account", () => {
  it("answers 401 without a session or token, and deletes nothing", async () => {
    auth.value = null;
    expect((await del()).status).toBe(401);
    expect(account.deleteAccount).not.toHaveBeenCalled();
  });

  it("deletes the caller's account with their own client and says so", async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(account.deleteAccount).toHaveBeenCalledWith({ tag: "client" });
  });

  it("fails loudly rather than answering success when the delete did not happen", async () => {
    account.deleteAccount.mockRejectedValue(new Error("boom"));
    await expect(del()).rejects.toThrow("boom");
  });
});
