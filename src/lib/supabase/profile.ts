"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, getUserId } from "./server";
import { addTeam, TeamNotFound } from "./teams";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** The manager's saved FPL team ID, so My Squad loads without asking again. */
export async function getSavedEntryId(): Promise<number | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("fpl_entry_id")
    .eq("id", userId)
    .maybeSingle();

  return (data?.fpl_entry_id as number | null) ?? null;
}

export async function saveEntryId(entryId: number): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Sign in to remember your team ID." };
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return { ok: false, error: "That is not a valid FPL team ID." };
  }

  // Adding it saves the team under its FPL name and makes it the one My Squad shows.
  try {
    await addTeam((await createClient()) as unknown as SupabaseClient, userId, entryId);
  } catch (e) {
    return { ok: false, error: e instanceof TeamNotFound ? e.message : "Could not save the team." };
  }

  revalidatePath("/squad");
  return { ok: true };
}
