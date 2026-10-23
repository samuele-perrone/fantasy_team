import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deletes the signed-in user's account and everything saved under it: profile, saved teams and
 * watchlist all cascade from the auth user. Runs through `delete_my_account()`
 * (migration 0007), which can only ever delete the caller, so no service-role key is needed.
 * App Store guideline 5.1.1(v) requires this to be possible from inside the app.
 */
export async function deleteAccount(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw new Error(error.message);
}
