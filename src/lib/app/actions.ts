"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserId } from "@/lib/supabase/server";
import { addToWatchlist, removeFromWatchlist } from "@/lib/supabase/watchlist";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Star or unstar a player from any page. Forms post the player id and the desired state. */
export async function setWatched(formData: FormData): Promise<void> {
  const userId = await getUserId();
  const elementId = Number(formData.get("playerId"));
  if (!userId || !Number.isInteger(elementId) || elementId <= 0) return;

  const supabase = (await createClient()) as unknown as SupabaseClient;
  if (formData.get("watch") === "1") await addToWatchlist(supabase, userId, elementId);
  else await removeFromWatchlist(supabase, elementId);

  revalidatePath("/squad");
  revalidatePath("/watchlist");
  revalidatePath(`/players/${elementId}`);
}
