import { getRequestAuth } from "@/lib/supabase/server";
import { addTeam, TeamNotFound } from "@/lib/supabase/teams";

export const dynamic = "force-dynamic";

/** GET /api/v1/profile — the FPL team ID saved for the caller, or null. */
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { data } = await auth.supabase
    .from("profiles")
    .select("fpl_entry_id")
    .eq("id", auth.userId)
    .maybeSingle();
  return Response.json({ entryId: (data?.fpl_entry_id as number | null) ?? null });
}

/**
 * PUT /api/v1/profile { "entryId": 123456 } — save the caller's FPL team ID.
 *
 * The ID is checked against FPL before it is saved, so the app can tell the manager at once
 * that they mistyped it, rather than saving it and failing on every load afterwards. Prefer
 * /api/v1/teams, which also lists and switches the manager's saved teams.
 */
export async function PUT(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const entryId = Number(body?.entryId);
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return Response.json({ error: "entryId must be a positive whole number" }, { status: 400 });
  }
  // The same as POST /api/v1/teams: saved under its FPL name, and shown on My Squad. Kept so
  // app builds from before saved teams go on working.
  try {
    await addTeam(auth.supabase, auth.userId, entryId);
  } catch (e) {
    if (e instanceof TeamNotFound) return Response.json({ error: e.message }, { status: 404 });
    return Response.json({ error: e instanceof Error ? e.message : "Could not save" }, { status: 500 });
  }
  return Response.json({ entryId });
}
