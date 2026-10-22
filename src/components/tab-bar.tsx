"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABS } from "./nav";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ReactNode> = {
  "/matches": (
    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5l3.3 2.4-1.3 3.9h-4l-1.3-3.9zM12 3.5v4M15.3 9.9l4.1-1.3M14 13.8l2.5 3.5M10 13.8l-2.5 3.5M8.7 9.9L4.6 8.6" />
    </g>
  ),
  "/squad": (
    <path d="M7 3l3 2h4l3-2 4 4-3 3v10H6V10L3 7z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  ),
  "/players": (
    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
      <path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M18 13.9c2.1.9 3.5 3.1 3.5 6.1" />
    </g>
  ),
  "/watchlist": (
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  ),
};

/** Bottom tabs, as the iOS app will have them, at every width. */
export function TabBar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-pitch-700/80 bg-pitch-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-xl">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition",
                active ? "text-brand-400" : "text-slate-400 hover:text-white",
              )}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
                {ICONS[tab.href]}
              </svg>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
