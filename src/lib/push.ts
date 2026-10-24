import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** One phone's live-match notification settings, as the app sends them. */
export interface PushSettings {
  token: string;
  environment: "sandbox" | "production";
  enabled: boolean;
  scope: "mine" | "all";
  goals: boolean;
  redCards: boolean;
  fullTime: boolean;
  /** a signed-out phone's FPL team, for "matches with my players" */
  entryId: number | null;
}

/** The app's request body checked field by field; null when anything is missing or wrong. */
export function parsePushSettings(body: unknown): PushSettings | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const flag = (v: unknown) => (typeof v === "boolean" ? v : null);
  const token = typeof b.token === "string" ? b.token.toLowerCase() : "";
  const entryId = b.entryId === null || b.entryId === undefined ? null : Number(b.entryId);
  const settings = {
    token,
    environment: b.environment,
    enabled: flag(b.enabled),
    scope: b.scope,
    goals: flag(b.goals),
    redCards: flag(b.redCards),
    fullTime: flag(b.fullTime),
    entryId,
  };
  if (!/^[0-9a-f]{32,200}$/.test(token)) return null;
  if (settings.environment !== "sandbox" && settings.environment !== "production") return null;
  if (settings.scope !== "mine" && settings.scope !== "all") return null;
  if ([settings.enabled, settings.goals, settings.redCards, settings.fullTime].includes(null)) return null;
  if (entryId !== null && !(Number.isInteger(entryId) && entryId > 0)) return null;
  return settings as PushSettings;
}

/**
 * Saves the settings through register_push_device() (migration 0008), which takes the
 * signed-in account from the client's session, if it has one, and never from the request.
 */
export async function savePushSettings(supabase: SupabaseClient, s: PushSettings): Promise<void> {
  const { error } = await supabase.rpc("register_push_device", {
    p_token: s.token,
    p_environment: s.environment,
    p_enabled: s.enabled,
    p_scope: s.scope,
    p_goals: s.goals,
    p_red_cards: s.redCards,
    p_full_time: s.fullTime,
    p_entry_id: s.entryId,
  });
  if (error) throw new Error(error.message);
}
