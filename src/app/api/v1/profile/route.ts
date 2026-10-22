import { getRequestAuth } from "@/lib/supabase/server";
import { getEntry } from "@/lib/fpl/client";

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
 * that they mistyped it, rather than saving it and failing on every load afterwards.
 */
export async function PUT(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const entryId = Number(body?.entryId);
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return Response.json({ error: "entryId must be a positive whole number" }, { status: 400 });
  }
  try {
    await getEntry(entryId);
  } catch {
    return Response.json({ error: `No FPL team found for ID ${entryId}` }, { status: 404 });
  }

  const { error } = await auth.supabase
    .from("profiles")
    .upsert({ id: auth.userId, fpl_entry_id: entryId }, { onConflict: "id" });
  return error
    ? Response.json({ error: error.message }, { status: 500 })
    : Response.json({ entryId });
}
