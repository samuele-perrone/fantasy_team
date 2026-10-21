import { getRequestAuth } from "@/lib/supabase/server";
import { getWatchedPlayers } from "@/lib/app/squad";
import { addToWatchlist, listWatchlist, removeFromWatchlist } from "@/lib/supabase/watchlist";

export const dynamic = "force-dynamic";

async function savedEntryId(auth: NonNullable<Awaited<ReturnType<typeof getRequestAuth>>>) {
  const { data } = await auth.supabase
    .from("profiles")
    .select("fpl_entry_id")
    .eq("id", auth.userId)
    .maybeSingle();
  return (data?.fpl_entry_id as number | null) ?? null;
}

/** GET /api/v1/watchlist — watched players, each against the squad player they would replace. */
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });
  const ids = await listWatchlist(auth.supabase);
  return Response.json({ players: await getWatchedPlayers(ids, await savedEntryId(auth)) });
}

function playerIdFrom(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** POST /api/v1/watchlist { "playerId": 123 } */
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = playerIdFrom(body?.playerId);
  if (!id) return Response.json({ error: "playerId required" }, { status: 400 });
  const error = await addToWatchlist(auth.supabase, auth.userId, id);
  return error ? Response.json({ error }, { status: 500 }) : Response.json({ ok: true });
}

/** DELETE /api/v1/watchlist?playerId=123 */
export async function DELETE(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });
  const id = playerIdFrom(new URL(req.url).searchParams.get("playerId"));
  if (!id) return Response.json({ error: "playerId required" }, { status: 400 });
  const error = await removeFromWatchlist(auth.supabase, id);
  return error ? Response.json({ error }, { status: 500 }) : Response.json({ ok: true });
}
