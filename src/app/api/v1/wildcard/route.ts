import { getWildcardView } from "@/lib/app/squad";
import { entryRoute } from "@/lib/app/entry-route";
import { getRequestAuth } from "@/lib/supabase/server";
import { listWatchlist } from "@/lib/supabase/watchlist";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/wildcard?id=<FPL team id>&watch=1
 *
 * The best squad a wildcard could buy with this team's budget, and whether it is worth the
 * chip. Without `id` it uses the team ID saved on the caller's profile. `watch=1` builds it
 * around the caller's watchlist where it fits; signed out there is no watchlist, so it is
 * ignored.
 */
export const GET = entryRoute(async (entryId, req) => {
  const watch = new URL(req.url).searchParams.get("watch") === "1";
  const auth = watch ? await getRequestAuth(req) : null;
  return getWildcardView(entryId, auth ? await listWatchlist(auth.supabase) : []);
});
