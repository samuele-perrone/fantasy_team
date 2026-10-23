import Link from "next/link";
import { forgetTeam, selectTeam } from "@/lib/app/actions";
import type { SavedTeam } from "@/lib/supabase/teams";
import { cn } from "@/lib/utils";

/**
 * The squad's name, opening to the manager's saved teams: tap one to show it, × to forget it,
 * or add another by ID. A <details> with server-action forms, so it needs no client JS.
 */
export function TeamSwitcher({
  name,
  current,
  teams,
}: {
  name: string;
  /** the FPL team ID on screen */
  current: number;
  teams: SavedTeam[];
}) {
  return (
    <details className="group relative inline-block max-w-full">
      <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        <h1 className="truncate text-[22px] font-bold tracking-tight text-white md:text-[28px]">
          {name}
        </h1>
        <svg
          viewBox="0 0 20 20"
          aria-hidden
          className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180"
        >
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="sr-only">Switch team</span>
      </summary>

      <div className="panel absolute left-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] p-1.5 shadow-xl">
        <div className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
          Your teams
        </div>
        <ul>
          {teams.map((t) => {
            const active = t.entryId === current;
            return (
              <li key={t.entryId} className="flex items-center gap-1">
                <form action={selectTeam} className="min-w-0 flex-1">
                  <input type="hidden" name="entryId" value={t.entryId} />
                  <button
                    type="submit"
                    disabled={active}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition",
                      active ? "bg-brand-500/12" : "hover:bg-pitch-800",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-[14px] font-semibold",
                          active ? "text-brand-300" : "text-white",
                        )}
                      >
                        {t.name}
                      </span>
                      <span className="block truncate text-[11.5px] text-slate-500">
                        {t.managerName ? `${t.managerName} · ` : ""}ID {t.entryId}
                      </span>
                    </span>
                    {active && <span className="text-[13px] text-brand-300">✓</span>}
                  </button>
                </form>
                <form action={forgetTeam}>
                  <input type="hidden" name="entryId" value={t.entryId} />
                  <button
                    type="submit"
                    aria-label={`Remove ${t.name}`}
                    title={`Remove ${t.name}`}
                    className="grid h-9 w-9 place-items-center rounded-lg text-[16px] text-slate-500 transition hover:bg-pitch-800 hover:text-rose-300"
                  >
                    ×
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
        <Link
          href="/squad?enter=1"
          className="mt-1 flex items-center gap-2 rounded-lg border-t border-pitch-800 px-2.5 py-2.5 text-[13.5px] font-semibold text-brand-400 hover:bg-pitch-800"
        >
          + Add another team
        </Link>
      </div>
    </details>
  );
}
