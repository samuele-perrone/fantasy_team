"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function AuthButton({
  email,
  compact,
  full,
  redirectTo,
}: {
  email: string | null;
  /** header variant — icon-sized, no descriptive text */
  compact?: boolean;
  /** full-width variant for the login page */
  full?: boolean;
  /** explicit post-login destination; defaults to the current page */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      // Signing in from /login must return to the intended page, not back to /login.
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(
          redirectTo ?? location.pathname + location.search,
        )}`,
      },
    });
    if (error) setBusy(false);
  };

  const signOut = async () => {
    setBusy(true);
    await createClient().auth.signOut();
    // The proxy will bounce the now-unauthenticated request to /login.
    router.push("/login");
    router.refresh();
  };

  if (email) {
    return (
      <div className="flex items-center gap-2">
        {!compact && (
          <span className="max-w-[160px] truncate text-[12px] text-slate-400">{email}</span>
        )}
        <button
          type="button"
          onClick={signOut}
          disabled={busy}
          className="rounded-lg border border-pitch-600 px-3 py-1.5 text-[12.5px] font-semibold text-slate-300 transition hover:border-brand-500 hover:text-white disabled:opacity-50"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={busy}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition disabled:opacity-50",
        full
          ? "w-full border-transparent bg-white px-4 py-3 text-[14px] text-pitch-950 hover:bg-slate-100"
          : "border-pitch-600 bg-pitch-900 text-slate-200 hover:border-brand-500 hover:text-white",
        !full && (compact ? "px-3 py-1.5 text-[12.5px]" : "px-4 py-2 text-[13.5px]"),
      )}
    >
      <GoogleMark />
      {busy ? "Redirecting…" : "Sign in with Google"}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4 4 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
    </svg>
  );
}
