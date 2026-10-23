import { deleteAccount } from "@/lib/supabase/account";
import { getRequestAuth } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/v1/account
 *
 * Deletes the caller's account and everything saved under it, for the iOS app's "Delete
 * account" (App Store guideline 5.1.1(v)). Checks auth itself — see getRequestAuth. Answers
 * `{ deleted: true }` like the app's other writes; the app then signs out locally.
 */
export async function DELETE(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return Response.json({ error: "Not signed in" }, { status: 401 });
  await deleteAccount(auth.supabase);
  return Response.json({ deleted: true });
}
