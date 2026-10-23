import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthButton } from "@/components/auth-button";
import { deleteMyAccount } from "@/lib/app/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Account" };

/** The signed-in account: who you are, sign out, and delete everything. */
export default async function AccountPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/account");

  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-[22px] font-bold tracking-tight text-white md:text-[28px]">Account</h1>

      <div className="panel flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
            Signed in as
          </div>
          <div className="truncate text-[14px] font-semibold text-white">
            {data.user.email ?? "Unknown email"}
          </div>
        </div>
        <AuthButton email={data.user.email ?? ""} compact />
      </div>

      <div className="panel mt-4 px-4 py-4">
        <h2 className="text-[14px] font-bold text-white">Delete account</h2>
        <p className="mt-1 text-[12.5px] leading-snug text-slate-400">
          Removes your account, your saved FPL teams and your watchlist, on the website and in
          the app. This cannot be undone. Your FPL team itself is not affected.
        </p>
        {/* Asks twice: the first button only opens the warning with the real one. */}
        <details className="group mt-3">
          <summary className="inline-flex cursor-pointer list-none rounded-lg border border-rose-500/40 px-3 py-1.5 text-[12.5px] font-semibold text-rose-300 hover:bg-rose-500/10 group-open:hidden [&::-webkit-details-marker]:hidden">
            Delete my account…
          </summary>
          <form
            action={deleteMyAccount}
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-3"
          >
            <p className="text-[12.5px] font-semibold text-rose-300">
              Delete your account and everything saved in it?
            </p>
            <button
              type="submit"
              className="mt-2.5 rounded-lg bg-[#e11d48] px-3 py-1.5 text-[12.5px] font-bold text-[#ffffff] hover:bg-[#be123c]"
            >
              Yes, delete everything
            </button>
          </form>
        </details>
      </div>
    </div>
  );
}
