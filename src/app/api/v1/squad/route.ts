import { getRequestAuth } from "@/lib/supabase/server";
import { getSquadView } from "@/lib/app/squad";
import { EntryNotFound } from "@/lib/fpl/entry";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/squad?id=<FPL team id>
 *
 * The My Squad tab as JSON: verdicts, replacements and suggestions. Without `id` it uses the
 * team ID saved on the caller's profile. Checks auth itself — see getRequestAuth.
 */
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });

  const param = new URL(req.url).searchParams.get("id");
  let entryId = param ? Number(param) : null;
  if (!entryId) {
    const { data } = await auth.supabase
      .from("profiles")
      .select("fpl_entry_id")
      .eq("id", auth.userId)
      .maybeSingle();
    entryId = (data?.fpl_entry_id as number | null) ?? null;
  }
  if (!entryId || !Number.isInteger(entryId) || entryId <= 0) {
    return Response.json({ error: "No FPL team ID" }, { status: 400 });
  }

  try {
    return Response.json(await getSquadView(entryId));
  } catch (e) {
    if (e instanceof EntryNotFound) return Response.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
