import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowed } from "@/lib/auth/allowlist";

/** Paths reachable without a session. Everything else redirects to /login. */
const PUBLIC_PREFIXES = ["/login", "/auth"];

/**
 * Refreshes the Supabase session and gates the whole site behind it.
 *
 * Server Components cannot write cookies, so the refresh has to happen here — and any cookies
 * it sets must be carried onto the redirect response too, otherwise the refreshed session is
 * dropped and the user bounces between /login and their destination forever.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims verifies the JWT signature; getSession would trust the cookie blindly.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;

  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  /** Redirect while preserving any refreshed auth cookies. */
  const redirectTo = (pathName: string, next?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathName;
    url.search = "";
    if (next && next !== "/") url.searchParams.set("next", next);

    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  // Anyone with a Google account can authenticate, so a valid session is not enough — the
  // account has to be on the allow-list. Denied sessions are signed out rather than left to
  // bounce off the gate on every request.
  if (signedIn && !isAllowed(email)) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("denied", email ?? "1");
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  if (!signedIn && !isPublic) return redirectTo("/login", pathname + search);

  // Nothing to do on the login page once you are already in.
  if (signedIn && pathname === "/login") {
    const next = request.nextUrl.searchParams.get("next");
    return redirectTo(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and images — those never need a session.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
