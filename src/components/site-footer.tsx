"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./nav";

/** Site footer, hidden on the login page where there is nothing to navigate to yet. */
export function SiteFooter() {
  if (usePathname() === "/login") return null;

  return (
    <footer className="mt-12 border-t border-pitch-800 bg-pitch-950/60">
      <div className="mx-auto max-w-[1500px] px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {NAV.map((group) => (
            <div key={group.label}>
              <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {group.label}
              </div>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-[13px] text-slate-400 transition hover:text-brand-400"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-8 border-t border-pitch-800 pt-6 text-[11.5px] leading-relaxed text-slate-600">
          Data from the official Fantasy Premier League API. Projections are modelled in-house
          and are not affiliated with or endorsed by the Premier League.
        </p>
      </div>
    </footer>
  );
}
