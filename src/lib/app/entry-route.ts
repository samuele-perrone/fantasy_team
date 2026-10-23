import "server-only";
import { getRequestAuth } from "@/lib/supabase/server";
import { EntryNotFound } from "@/lib/fpl/entry";

/**
 * A GET handler for an `/api/v1` view of one FPL team: `?id=` names it, or else the caller's
 * active saved team does. With `?id=` it answers signed out too, as the website does: a team
 * ID is public on FPL, and needing an account just to look would fall foul of App Store
 * guideline 5.1.1. Reads auth itself — see getRequestAuth. 401 with neither an ID nor a
 * session, 400 without a usable ID, 404 for a team FPL does not have.
 */
export function entryRoute<T>(load: (entryId: number) => Promise<T>) {
  return async function GET(req: Request) {
    const param = new URL(req.url).searchParams.get("id");
    let entryId = param ? Number(param) : null;
    if (!param) {
      const auth = await getRequestAuth(req);
      if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });
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
      return Response.json(await load(entryId));
    } catch (e) {
      if (e instanceof EntryNotFound) return Response.json({ error: e.message }, { status: 404 });
      throw e;
    }
  };
}
