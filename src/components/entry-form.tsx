import { redirect } from "next/navigation";
import { saveEntryId } from "@/lib/supabase/squads";

/**
 * Small server-action form used by every tool that needs an FPL entry ID. Keeping it a
 * server action means these pages stay fully server-rendered.
 */
export function EntryForm({
  action,
  defaultValue,
  label = "FPL Team ID",
  cta = "Load team",
  signedIn = false,
}: {
  action: string;
  defaultValue?: string;
  label?: string;
  cta?: string;
  /** when signed in, the id is also stored on the profile so it prefills next visit */
  signedIn?: boolean;
}) {
  async function submit(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "").trim();
    if (!/^\d+$/.test(id)) redirect(`${action}?error=invalid`);
    if (formData.get("remember") === "on") await saveEntryId(Number(id));
    redirect(`${action}?id=${id}`);
  }

  return (
    <form action={submit} className="panel px-4 py-3.5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="entry-id"
            className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500"
          >
            {label}
          </label>
          <input
            id="entry-id"
            name="id"
            inputMode="numeric"
            defaultValue={defaultValue}
            placeholder="e.g. 1234567"
            className="h-10 w-52 rounded-lg border border-pitch-700 bg-pitch-900 px-3 text-[14px] outline-none placeholder:text-slate-600 focus:border-brand-500"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-brand-500 px-5 text-[13.5px] font-bold text-pitch-950 transition hover:bg-brand-400"
        >
          {cta}
        </button>

        {signedIn && (
          <label className="flex h-10 cursor-pointer items-center gap-2 text-[12.5px] text-slate-400">
            <input
              type="checkbox"
              name="remember"
              defaultChecked
              className="accent-brand-500"
            />
            Remember this ID on my account
          </label>
        )}
      </div>

      <FindYourId />
    </form>
  );
}

/** Step-by-step instructions for locating an FPL entry ID on the official site. */
export function FindYourId({ className }: { className?: string }) {
  return (
    <div className={className ?? "mt-4 border-t border-pitch-800 pt-3"}>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        How to find your team ID
      </div>
      <ol className="space-y-1 text-[12.5px] leading-relaxed text-slate-400">
        <Step n={1}>
          Log in to the{" "}
          <a
            href="https://fantasy.premierleague.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-400 hover:underline"
          >
            Official Fantasy Premier League website
          </a>
          .
        </Step>
        <Step n={2}>
          Click on the <strong className="font-semibold text-slate-200">Pick Team</strong> tab.
        </Step>
        <Step n={3}>
          Open your <strong className="font-semibold text-slate-200">Gameweek History</strong> or{" "}
          <strong className="font-semibold text-slate-200">Transfer History</strong>.
        </Step>
        <Step n={4}>
          Look at the browser address bar. Your ID is the number sequence right after{" "}
          <code className="rounded bg-pitch-900 px-1 py-px text-[11.5px] text-slate-300">
            /entry/
          </code>
          .
        </Step>
      </ol>
      <p className="num mt-2 text-[11.5px] text-slate-600">
        fantasy.premierleague.com/entry/
        <strong className="font-bold text-brand-400">1234567</strong>/history
      </p>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="num mt-px grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full bg-pitch-700 text-[10px] font-bold text-slate-300">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
