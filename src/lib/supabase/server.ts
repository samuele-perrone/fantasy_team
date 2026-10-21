import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createTokenClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isAllowed } from "@/lib/auth/allowlist";

/** Server client bound to the request's cookies. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies; middleware refreshes the session instead.
          }
        },
      },
    },
  );
}

/**
 * The signed-in user's id, or null.
 *
 * Uses `getClaims()`, which verifies the JWT signature — `getSession()` returns whatever is in
 * the cookie without validating it, so it must never gate access to data.
 */
export async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  // Defence in depth: the proxy gates navigation, but a route outside its matcher would
  // otherwise still hand data to an account that is not on the allow-list.
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  if (!isAllowed(email)) return null;

  return data.claims.sub;
}

export interface RequestAuth {
  userId: string;
  supabase: SupabaseClient;
}

/**
 * Auth for `/api/v1` routes, which serve the web app today and the iOS app later.
 *
 * A native app has no cookie jar shared with the site, so it sends the Supabase access token
 * as `Authorization: Bearer …` instead. The returned client carries that token, so row level
 * security sees the same user either way. Without a bearer header this falls back to the
 * cookie session the web app uses. Both paths verify the JWT and apply the allow-list.
 */
export async function getRequestAuth(req: Request): Promise<RequestAuth | null> {
  const header = req.headers.get("authorization");
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    const supabase = await createClient();
    const userId = await getUserId();
    return userId ? { userId, supabase: supabase as unknown as SupabaseClient } : null;
  }

  const supabase = createTokenClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  if (!isAllowed(email)) return null;
  return { userId: data.claims.sub, supabase };
}
