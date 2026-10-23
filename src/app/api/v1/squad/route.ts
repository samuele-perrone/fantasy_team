import { getSquadView } from "@/lib/app/squad";
import { entryRoute } from "@/lib/app/entry-route";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/squad?id=<FPL team id>
 *
 * The My Squad tab as JSON: verdicts, replacements, suggestions and the captain. Without `id`
 * it uses the team ID saved on the caller's profile.
 */
export const GET = entryRoute(getSquadView);
