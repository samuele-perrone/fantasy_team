"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserId } from "@/lib/supabase/server";
import { addToWatchlist, removeFromWatchlist } from "@/lib/supabase/watchlist";
import { removeTeam, switchTeam } from "@/lib/supabase/teams";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Star or unstar a player from any page. Forms post the player id and the desired state. */
export async function setWatched(formData: FormData): Promise<void> {
  const userId = await getUserId();
  const elementId = Number(formData.get("playerId"));
  if (!userId || !Number.isInteger(elementId) || elementId <= 0) return;

  const supabase = (await createClient()) as unknown as SupabaseClient;
  if (formData.get("watch") === "1") await addToWatchlist(supabase, userId, elementId);
  else await removeFromWatchlist(supabase, elementId);

  // Every page that shows a star, so the one the form was posted from re-renders with it.
  revalidatePath("/squad");
  revalidatePath("/watchlist");
  revalidatePath("/players");
  revalidatePath("/matches");
  revalidatePath(`/players/${elementId}`);
}

const entryIdFrom = (formData: FormData) => {
  const id = Number(formData.get("entryId"));
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** Show another saved team on My Squad. */
export async function selectTeam(formData: FormData): Promise<void> {
  const userId = await getUserId();
  const entryId = entryIdFrom(formData);
  if (!userId || !entryId) return;
  await switchTeam((await createClient()) as unknown as SupabaseClient, userId, entryId).catch(() => {});
  revalidatePath("/squad");
  revalidatePath("/watchlist");
  revalidatePath("/matches");
}

/** Forget a saved team; if it was the one shown, the next saved team takes its place. */
export async function forgetTeam(formData: FormData): Promise<void> {
  const userId = await getUserId();
  const entryId = entryIdFrom(formData);
  if (!userId || !entryId) return;
  await removeTeam((await createClient()) as unknown as SupabaseClient, userId, entryId).catch(() => {});
  revalidatePath("/squad");
  revalidatePath("/watchlist");
  revalidatePath("/matches");
}
