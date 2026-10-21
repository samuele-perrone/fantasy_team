import { getRequestAuth } from "@/lib/supabase/server";
import { getMatchday } from "@/lib/app/matches";
import { listWatchlist } from "@/lib/supabase/watchlist";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/matches?gw=<gameweek>
 *
 * The Matches tab as JSON: every match in the gameweek grouped by day, with the caller's squad
 * and watchlist players highlighted. Without `gw` it opens on the same gameweek the page does.
 * Checks auth itself — see getRequestAuth.
 */
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });

  const param = new URL(req.url).searchParams.get("gw");
  const gw = param === null ? null : Number(param);
  if (gw !== null && (!Number.isInteger(gw) || gw <= 0)) {
    return Response.json({ error: "Gameweek must be a positive whole number" }, { status: 400 });
  }

  const [{ data }, watchIds] = await Promise.all([
    auth.supabase.from("profiles").select("fpl_entry_id").eq("id", auth.userId).maybeSingle(),
    listWatchlist(auth.supabase),
  ]);
  const entryId = (data?.fpl_entry_id as number | null) ?? null;

  return Response.json(await getMatchday(gw, { entryId, watchIds }));
}
