import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The watchlist, as plain functions over a Supabase client so the cookie-based server actions
 * and the token-based `/api/v1` routes share one implementation. Row level security restricts
 * every query to the caller's own rows regardless of the filters here.
 */

export async function listWatchlist(supabase: SupabaseClient): Promise<number[]> {
  const { data, error } = await supabase
    .from("watchlist")
    .select("element_id")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data.map((r) => r.element_id as number);
}

export async function addToWatchlist(
  supabase: SupabaseClient,
  userId: string,
  elementId: number,
): Promise<string | null> {
  const { error } = await supabase
    .from("watchlist")
    .upsert({ user_id: userId, element_id: elementId }, { onConflict: "user_id,element_id" });
  return error?.message ?? null;
}

export async function removeFromWatchlist(
  supabase: SupabaseClient,
  elementId: number,
): Promise<string | null> {
  const { error } = await supabase.from("watchlist").delete().eq("element_id", elementId);
  return error?.message ?? null;
}
