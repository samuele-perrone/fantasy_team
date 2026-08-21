"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserId } from "./server";

export interface SavedSquad {
  id: string;
  name: string;
  playerIds: number[];
  captainId: number | null;
  viceCaptainId: number | null;
  formation: string | null;
  bank: number;
  updatedAt: string;
}

/**
 * Reserved name for the builder's working squad. It is upserted on every edit and hidden
 * from the saved list, so the builder survives a refresh without the user having to think
 * about saving. Naming it this way avoids a schema migration for a draft flag.
 */
const DRAFT_NAME = "__working_draft__";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Every query below is additionally constrained by row level security, so a caller can only
 * ever touch their own rows even if the `user_id` filter here were wrong.
 */
export async function listSquads(): Promise<SavedSquad[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("squads")
    .select("id, name, player_ids, captain_id, vice_captain_id, formation, bank, updated_at")
    .neq("name", DRAFT_NAME)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    playerIds: (r.player_ids as number[]) ?? [],
    captainId: r.captain_id as number | null,
    viceCaptainId: r.vice_captain_id as number | null,
    formation: r.formation as string | null,
    bank: Number(r.bank ?? 0),
    updatedAt: r.updated_at as string,
  }));
}

export async function saveSquad(input: {
  id?: string;
  name: string;
  playerIds: number[];
  captainId: number | null;
  viceCaptainId: number | null;
  formation: string | null;
  bank: number;
}): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Sign in to save a squad." };

  const name = input.name.trim().slice(0, 60) || "My squad";
  if (input.playerIds.length !== 15) {
    return { ok: false, error: "A squad must have exactly 15 players." };
  }

  const supabase = await createClient();
  const row = {
    user_id: userId,
    name,
    player_ids: input.playerIds,
    captain_id: input.captainId,
    vice_captain_id: input.viceCaptainId,
    formation: input.formation,
    bank: Math.min(Math.max(input.bank, 0), 100),
  };

  const { error } = input.id
    ? await supabase.from("squads").update(row).eq("id", input.id)
    : await supabase.from("squads").insert(row);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/squad");
  return { ok: true };
}

export async function deleteSquad(id: string): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("squads").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/squad");
  return { ok: true };
}

/** The manager's saved FPL entry id, so /my-team can prefill it. */
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

  revalidatePath("/my-team");
  return { ok: true };
}

/** The builder's autosaved working squad, if there is one. */
export async function getDraft(): Promise<SavedSquad | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("squads")
    .select("id, name, player_ids, captain_id, vice_captain_id, formation, bank, updated_at")
    .eq("name", DRAFT_NAME)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id as string,
    name: data.name as string,
    playerIds: (data.player_ids as number[]) ?? [],
    captainId: data.captain_id as number | null,
    viceCaptainId: data.vice_captain_id as number | null,
    formation: data.formation as string | null,
    bank: Number(data.bank ?? 0),
    updatedAt: data.updated_at as string,
  };
}

/**
 * Autosave the builder. Called on every edit, so it updates the single draft row rather than
 * accumulating history. A partial squad is allowed here — unlike saveSquad, which requires a
 * legal 15 — because the whole point is not losing work in progress.
 */
export async function saveDraft(input: {
  playerIds: number[];
  captainId: number | null;
  viceCaptainId: number | null;
  formation: string | null;
  bank: number;
}): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const row = {
    user_id: userId,
    name: DRAFT_NAME,
    player_ids: input.playerIds,
    captain_id: input.captainId,
    vice_captain_id: input.viceCaptainId,
    formation: input.formation,
    bank: Math.min(Math.max(input.bank, 0), 100),
  };

  const { data: existing } = await supabase
    .from("squads")
    .select("id")
    .eq("name", DRAFT_NAME)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("squads").update(row).eq("id", existing.id)
    : await supabase.from("squads").insert(row);

  return error ? { ok: false, error: error.message } : { ok: true };
}
