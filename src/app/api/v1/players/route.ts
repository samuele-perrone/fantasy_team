import { getRequestAuth } from "@/lib/supabase/server";
import { browsePlayers, parseBrowseQuery } from "@/lib/app/players";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/players?q=&pos=GKP|DEF|MID|FWD&team=<FPL team id>&max=<£m>&sort=&n=
 *
 * The Players tab as JSON. Every parameter is optional and malformed ones are ignored, as on
 * the page. Checks auth itself — see getRequestAuth.
 */
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });

  return Response.json(await browsePlayers(parseBrowseQuery(new URL(req.url).searchParams)));
}
