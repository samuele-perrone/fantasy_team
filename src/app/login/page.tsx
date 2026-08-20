import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthButton } from "@/components/auth-button";
import { getUserId } from "@/lib/supabase/server";
import { allowlistUnconfigured } from "@/lib/auth/allowlist";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Fantasy Hub.",
  // The site is private, so keep it out of search results.
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  // Only ever bounce back to a path on this site.
  const next = raw?.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  // The proxy handles this too, but a direct visit should not flash the form.
  if (await getUserId()) redirect(next);

  const errorParam = Array.isArray(params.auth_error) ? params.auth_error[0] : params.auth_error;
  const deniedRaw = Array.isArray(params.denied) ? params.denied[0] : params.denied;
  const denied = deniedRaw ? (deniedRaw.includes("@") ? deniedRaw : null) : undefined;
  const unconfigured = allowlistUnconfigured();

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="panel px-7 py-8">
        <h1 className="text-[24px] font-black leading-tight tracking-tight text-white">
          Sign in to continue
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-slate-400">
          Points projections, OPTA stats, fixture analysis, an AI squad optimiser and saved
          squads — all behind your account.
        </p>

        {errorParam && (
          <p className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-300">
            {errorParam}
          </p>
        )}

        {deniedRaw !== undefined && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[12.5px] leading-relaxed text-amber-200">
            <strong className="font-bold">This account cannot access the site.</strong>{" "}
            {denied ? (
              <>
                <span className="font-mono">{denied}</span> is not on the allow-list. Sign in
                with a permitted account, or ask the owner to add this address.
              </>
            ) : (
              <>Sign in with a permitted account.</>
            )}
            {unconfigured && (
              <span className="mt-1.5 block text-amber-300/80">
                No allow-list is configured, so every account is currently denied. Set
                ALLOWED_EMAILS to a comma-separated list of addresses.
              </span>
            )}
          </div>
        )}

        {unconfigured && deniedRaw === undefined && (
          <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] leading-relaxed text-amber-200">
            ALLOWED_EMAILS is not set, so sign-in will be refused for every account. Set it to a
            comma-separated list of permitted addresses.
          </p>
        )}

        <div className="mt-6">
          <AuthButton email={null} redirectTo={next} full />
        </div>

        <ul className="mt-7 space-y-2 border-t border-pitch-800 pt-5 text-[12.5px] text-slate-500">
          <li className="flex gap-2">
            <span className="text-brand-400">•</span>
            Your squads are saved to your account and sync across devices
          </li>
          <li className="flex gap-2">
            <span className="text-brand-400">•</span>
            Your FPL team ID is remembered, so you never retype it
          </li>
          <li className="flex gap-2">
            <span className="text-brand-400">•</span>
            Only you can read your data — enforced in the database, not just the app
          </li>
        </ul>
      </div>

      <p className="mt-4 px-2 text-center text-[11.5px] leading-relaxed text-slate-600">
        Data from the official Fantasy Premier League API. Projections are modelled in-house
        and this site is not affiliated with the Premier League.
      </p>
    </div>
  );
}
