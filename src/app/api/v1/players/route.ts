import { browsePlayers, parseBrowseQuery } from "@/lib/app/players";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/players?q=&pos=GKP|DEF|MID|FWD&team=<FPL team id>&max=<£m>&sort=&n=
 *
 * The Players tab as JSON. Every parameter is optional and malformed ones are ignored, as on
 * the page. Public: browsing players needs no account (App Store guideline 5.1.1), and the
 * answer is the same for everyone.
 */
export async function GET(req: Request) {
  return Response.json(await browsePlayers(parseBrowseQuery(new URL(req.url).searchParams)));
}
