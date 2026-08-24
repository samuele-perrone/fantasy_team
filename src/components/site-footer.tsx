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
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[13px] text-slate-400 transition hover:text-brand-400"
            >
              {item.label}
            </Link>
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
