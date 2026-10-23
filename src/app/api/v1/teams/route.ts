import { getRequestAuth } from "@/lib/supabase/server";
import { addTeam, listTeams, removeTeam, switchTeam, TeamNotFound } from "@/lib/supabase/teams";

export const dynamic = "force-dynamic";

const entryIdFrom = (value: unknown) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** GET /api/v1/teams — the saved teams, and which one My Squad shows. */
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });
  return Response.json(await listTeams(auth.supabase, auth.userId));
}

/** POST /api/v1/teams { "entryId": 123 } — add a team (checked with FPL) and show it. */
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });
  const entryId = entryIdFrom((await req.json().catch(() => null))?.entryId);
  if (!entryId) return Response.json({ error: "entryId must be a positive whole number" }, { status: 400 });
  try {
    await addTeam(auth.supabase, auth.userId, entryId);
  } catch (e) {
    if (e instanceof TeamNotFound) return Response.json({ error: e.message }, { status: 404 });
    throw e;
  }
  return Response.json(await listTeams(auth.supabase, auth.userId));
}

/** PUT /api/v1/teams { "entryId": 123 } — show a saved team on My Squad. */
export async function PUT(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });
  const entryId = entryIdFrom((await req.json().catch(() => null))?.entryId);
  if (!entryId) return Response.json({ error: "entryId must be a positive whole number" }, { status: 400 });
  try {
    await switchTeam(auth.supabase, auth.userId, entryId);
  } catch (e) {
    if (e instanceof TeamNotFound) return Response.json({ error: e.message }, { status: 404 });
    throw e;
  }
  return Response.json(await listTeams(auth.supabase, auth.userId));
}

/** DELETE /api/v1/teams?entryId=123 — forget a saved team. */
export async function DELETE(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });
  const entryId = entryIdFrom(new URL(req.url).searchParams.get("entryId"));
  if (!entryId) return Response.json({ error: "entryId required" }, { status: 400 });
  return Response.json(await removeTeam(auth.supabase, auth.userId, entryId));
}
