import { getWildcardView } from "@/lib/app/squad";
import { entryRoute } from "@/lib/app/entry-route";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/wildcard?id=<FPL team id>
 *
 * The best squad a wildcard could buy with this team's budget, and whether it is worth the
 * chip. Without `id` it uses the team ID saved on the caller's profile.
 */
export const GET = entryRoute(getWildcardView);
