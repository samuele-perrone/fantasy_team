"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthButton } from "./auth-button";
import { LogoMark } from "./logo";
import { TABS } from "./nav";
import { isActiveTab, TAB_ICONS } from "./tab-bar";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

export function SiteHeader({
  deadline,
  gwLabel,
  email,
}: {
  deadline: string | null;
  gwLabel: string;
  email: string | null;
}) {
  const pathname = usePathname();
  const bare = pathname === "/login";

  return (
    <header className="sticky top-0 z-50 border-b border-pitch-700/80 bg-pitch-950/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-3 md:h-16 md:px-6 lg:px-8">
        <Link href="/squad" className="flex shrink-0 items-center gap-2">
          <LogoMark size={32} />
          <span className="text-[15px] font-bold tracking-tight whitespace-nowrap">
            Fantasy<span className="text-brand-400">Team</span>Hub
          </span>
        </Link>

        {!bare && (
          <nav aria-label="Main" className="ml-6 hidden items-center gap-1 lg:flex">
            {TABS.map((tab) => {
              const active = isActiveTab(pathname, tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-lg px-3 text-[13.5px] font-semibold transition",
                    active
                      ? "bg-brand-500/12 text-brand-300"
                      : "text-slate-400 hover:bg-pitch-800 hover:text-white",
                  )}
                >
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
                    {TAB_ICONS[tab.href]}
                  </svg>
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        )}
        {bare && (
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        )}
        {!bare && (
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {deadline && (
              <div className="text-right whitespace-nowrap">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {gwLabel} deadline
                </div>
                <Countdown iso={deadline} />
              </div>
            )}
            <ThemeToggle />
            {email ? (
              // Signed in: the account page has sign out and delete account.
              <Link
                href="/account"
                aria-label="Account"
                title={email}
                className="grid h-8 w-8 place-items-center rounded-lg border border-pitch-600 text-slate-300 transition hover:border-brand-500 hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
                  <circle cx="12" cy="8.5" r="3.5" />
                  <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
                </svg>
              </Link>
            ) : (
              <AuthButton email={null} compact />
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function Countdown({ iso }: { iso: string }) {
  const [label, setLabel] = useState("--");

  useEffect(() => {
    const tick = () => {
      const ms = new Date(iso).getTime() - Date.now();
      if (ms <= 0) return setLabel("Passed");
      const s = Math.floor(ms / 1000);
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      setLabel(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [iso]);

  return <div className="num text-[13px] font-bold text-brand-400">{label}</div>;
}
