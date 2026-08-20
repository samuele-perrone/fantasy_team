import "server-only";
import { createServerClient } from "@supabase/ssr";
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
