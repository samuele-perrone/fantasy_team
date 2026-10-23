import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteAccount } from "./account";

const client = (result: { error: { message: string } | null }) => {
  const rpc = vi.fn(async () => result);
  return { rpc, supabase: { rpc } as unknown as SupabaseClient };
};

describe("deleteAccount", () => {
  it("deletes through the database function that can only remove the caller", async () => {
    const { rpc, supabase } = client({ error: null });
    await deleteAccount(supabase);
    expect(rpc).toHaveBeenCalledWith("delete_my_account");
  });

  it("throws when the database refuses, so nobody is told an account is gone when it is not", async () => {
    const { supabase } = client({ error: { message: "Not signed in" } });
    await expect(deleteAccount(supabase)).rejects.toThrow("Not signed in");
  });
});
