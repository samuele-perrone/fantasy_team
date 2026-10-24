import { parsePushSettings, savePushSettings } from "@/lib/push";
import { createClient, getRequestAuth } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * PUT /api/v1/push { token, environment, enabled, scope, goals, redCards, fullTime, entryId }
 *
 * Saves a phone's live-match notification settings. Works signed out, as the app does: a
 * signed-out phone sends its FPL team ID for "matches with my players". Signed in, the phone is
 * tied to the account, so deleting the account removes it.
 */
export async function PUT(req: Request) {
  const settings = parsePushSettings(await req.json().catch(() => null));
  if (!settings) return Response.json({ error: "Invalid notification settings" }, { status: 400 });
  const auth = await getRequestAuth(req);
  const supabase = auth?.supabase ?? ((await createClient()) as unknown as SupabaseClient);
  await savePushSettings(supabase, settings);
  return Response.json({ saved: true });
}
