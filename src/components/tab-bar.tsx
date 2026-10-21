"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABS } from "./nav";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ReactNode> = {
  "/squad": (
    <path d="M7 3l3 2h4l3-2 4 4-3 3v10H6V10L3 7z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
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
