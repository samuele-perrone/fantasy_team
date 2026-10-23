import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEntry } from "@/lib/fpl/client";

/**
 * The FPL teams a manager has added, and which one My Squad shows.
 *
 * profiles.fpl_entry_id is the active team; saved_teams holds every team added, with the name
 * FPL gives it. Plain functions over a Supabase client, like the watchlist, so the cookie-based
 * pages and the token-based /api/v1 routes share them. Row level security restricts every
 * query to the caller's rows whatever the filters say.
 */

export interface SavedTeam {
  entryId: number;
  name: string;
  managerName: string | null;
}

export interface TeamsView {
  /** the team My Squad shows, or null before one is added */
  active: number | null;
  teams: SavedTeam[];
}

export class TeamNotFound extends Error {}

const toTeam = (r: { entry_id: number; name: string; manager_name: string | null }): SavedTeam => ({
  entryId: r.entry_id,
  name: r.name,
  managerName: r.manager_name,
});

async function activeEntry(supabase: SupabaseClient, userId: string): Promise<number | null> {
  const { data } = await supabase
    .from("profiles")
    .select("fpl_entry_id")
    .eq("id", userId)
    .maybeSingle();
  return (data?.fpl_entry_id as number | null) ?? null;
}

async function setActive(supabase: SupabaseClient, userId: string, entryId: number | null) {
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, fpl_entry_id: entryId }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

/** Looks the team up on FPL and stores it under its name. Throws TeamNotFound for a bad ID. */
async function store(supabase: SupabaseClient, userId: string, entryId: number): Promise<SavedTeam> {
  let entry;
  try {
    entry = await getEntry(entryId);
  } catch {
    throw new TeamNotFound(`No FPL team found for ID ${entryId}`);
  }
  const team = {
    user_id: userId,
    entry_id: entryId,
    // FPL allows 20 characters; the slice only guards the table's own limit.
    name: (entry.name || `Team ${entryId}`).trim().slice(0, 60),
    manager_name: `${entry.player_first_name} ${entry.player_last_name}`.trim() || null,
  };
  const { error } = await supabase.from("saved_teams").upsert(team, { onConflict: "user_id,entry_id" });
  if (error) throw new Error(error.message);
  return toTeam(team);
}

export async function listTeams(supabase: SupabaseClient, userId: string): Promise<TeamsView> {
  const [active, { data }] = await Promise.all([
    activeEntry(supabase, userId),
    supabase.from("saved_teams").select("entry_id, name, manager_name").order("created_at"),
  ]);
  const teams = (data ?? []).map(toTeam);
  // A profile from before saved teams has an active ID and nothing saved. Carry it over now,
  // so nobody has to add their team again.
  if (active && !teams.some((t) => t.entryId === active)) {
    try {
      teams.push(await store(supabase, userId, active));
    } catch {
      // FPL unreachable or the ID gone: still list it, just without its name.
      teams.push({ entryId: active, name: `Team ${active}`, managerName: null });
    }
  }
  return { active, teams };
}

/** Adds a team, checked with FPL, and makes it the one My Squad shows. */
export async function addTeam(supabase: SupabaseClient, userId: string, entryId: number): Promise<SavedTeam> {
  const team = await store(supabase, userId, entryId);
  await setActive(supabase, userId, entryId);
  return team;
}

/** Shows a saved team on My Squad. Only teams already added can be switched to. */
export async function switchTeam(supabase: SupabaseClient, userId: string, entryId: number): Promise<void> {
  const { teams } = await listTeams(supabase, userId);
  if (!teams.some((t) => t.entryId === entryId)) throw new TeamNotFound(`Team ${entryId} is not saved`);
  await setActive(supabase, userId, entryId);
}

/** Forgets a team. Removing the active one makes the earliest remaining team active. */
export async function removeTeam(supabase: SupabaseClient, userId: string, entryId: number): Promise<TeamsView> {
  const { error } = await supabase.from("saved_teams").delete().eq("entry_id", entryId);
  if (error) throw new Error(error.message);
  const { data } = await supabase
    .from("saved_teams")
    .select("entry_id, name, manager_name")
    .order("created_at");
  const teams = (data ?? []).map(toTeam);
  let active = await activeEntry(supabase, userId);
  if (active === entryId) {
    active = teams[0]?.entryId ?? null;
    await setActive(supabase, userId, active);
  }
  return { active, teams };
}
