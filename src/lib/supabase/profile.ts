"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserId } from "./server";

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

  const supabase = await createClient();
  // upsert keyed on the primary key, which is the auth user id
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, fpl_entry_id: entryId }, { onConflict: "id" });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/squad");
  return { ok: true };
}
