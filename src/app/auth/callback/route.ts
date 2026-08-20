import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** OAuth redirect target — exchanges the code for a session cookie. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error_description") ?? searchParams.get("error");
  // Only ever redirect to a path on this origin, so the callback cannot be used as an open redirect.
  const raw = searchParams.get("next") ?? "/squad";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/squad";

  if (error) {
    return NextResponse.redirect(`${origin}/squad?auth_error=${encodeURIComponent(error)}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return NextResponse.redirect(
        `${origin}/squad?auth_error=${encodeURIComponent(exchangeError.message)}`,
      );
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
