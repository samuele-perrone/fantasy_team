"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The Supabase client is loaded on the tap, not with the page: this button is in the header of
 * every page, and importing it statically put the whole library (~67 kB compressed, a quarter
 * of the site's JavaScript) on all of them for a button that is rarely pressed.
 */
const supabase = () => import("@/lib/supabase/client").then((m) => m.createClient());

export function AuthButton({
  email,
  compact,
  full,
  redirectTo,
  provider = "google",
}: {
  email: string | null;
  /** which account to sign in with; Apple is offered on the login page only */
  provider?: "google" | "apple";
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
    const { error } = await (await supabase()).auth.signInWithOAuth({
      provider,
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
    await (await supabase()).auth.signOut();
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
          aria-label="Sign out"
          title="Sign out"
          className={cn(
            "inline-flex items-center justify-center rounded-lg border border-pitch-600 font-semibold whitespace-nowrap text-slate-300 transition hover:border-brand-500 hover:text-white disabled:opacity-50",
            // In the header on a phone there is room for an icon, not the words.
            compact ? "h-8 w-8 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5" : "px-3 py-1.5",
            "text-[12.5px]",
          )}
        >
          {compact && (
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] sm:hidden" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />
            </svg>
          )}
          <span className={compact ? "hidden sm:inline" : undefined}>Sign out</span>
        </button>
      </div>
    );
  }

  if (provider === "apple") {
    // Apple's rules for the button: black, its logo, "Sign in with Apple". Fixed colours, so
    // it stays black in the light theme too; the border keeps it visible on the dark one.
    return (
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#3a3a3c] bg-[#000000] px-4 py-3 text-[14px] font-semibold text-[#ffffff] transition hover:bg-[#1c1c1e] disabled:opacity-50"
        aria-label="Sign in with Apple"
      >
        <AppleMark />
        <span>{busy ? "Redirecting…" : "Sign in with Apple"}</span>
      </button>
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
          ? "w-full border-pitch-700 bg-[#ffffff] px-4 py-3 text-[14px] text-ink hover:bg-[#eef1f7]"
          : "border-pitch-600 bg-pitch-900 whitespace-nowrap text-slate-200 hover:border-brand-500 hover:text-white",
        !full &&
          (compact
            ? "h-8 w-8 text-[12.5px] sm:h-auto sm:w-auto sm:px-3 sm:py-1.5"
            : "px-4 py-2 text-[13.5px]"),
      )}
      aria-label="Sign in with Google"
    >
      <GoogleMark />
      <span className={compact ? "hidden sm:inline" : undefined}>
        {busy ? "Redirecting…" : "Sign in with Google"}
      </span>
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

function AppleMark() {
  return (
    <svg viewBox="0 0 17 20" className="h-[18px] w-[15px]" fill="currentColor" aria-hidden>
      <path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2.1-.9-3.4-.9C3.5 4.7 1.9 5.7 1 7.2c-1.9 3.2-.5 8 1.3 10.6.9 1.3 1.9 2.7 3.3 2.6 1.3-.1 1.8-.8 3.4-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.1-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.8-1.1-2.8-4.2zM11.6 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z" />
    </svg>
  );
}
