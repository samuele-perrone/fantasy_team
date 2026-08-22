"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV } from "./nav";
import { AuthButton } from "./auth-button";
import { cn } from "@/lib/utils";

interface MenuState {
  path: string;
  group: string | null;
  mobile: boolean;
}

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
  // Menus are scoped to the route they were opened on, so navigating closes them without
  // needing an effect that would trigger a second render pass.
  const [menu, setMenu] = useState<MenuState>({ path: pathname, group: null, mobile: false });
  const stale = menu.path !== pathname;
  const open = stale ? null : menu.group;
  const mobileOpen = stale ? false : menu.mobile;

  const setOpen = (group: string | null) => setMenu({ path: pathname, group, mobile: false });
  const setMobileOpen = (mobile: boolean) =>
    setMenu({ path: pathname, group: null, mobile });

  // On the login page the only thing to show is the wordmark.
  const bare = pathname === "/login";

  return (
    <header className="sticky top-0 z-50 border-b border-pitch-700/80 bg-pitch-950/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-2 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-[11px] font-black tracking-tight text-pitch-950">
            FTH
          </span>
          <span className={cn("text-[15px] font-bold tracking-tight", bare ? "block" : "hidden sm:block")}>
            Fantasy<span className="text-brand-400">Team</span>Hub
          </span>
        </Link>

        {!bare && <nav className="ml-4 hidden items-center lg:flex" onMouseLeave={() => setOpen(null)}>
          {NAV.map((group) => (
            <div key={group.label} className="relative" onMouseEnter={() => setOpen(group.label)}>
              <button
                type="button"
                onClick={() => setOpen(open === group.label ? null : group.label)}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-3 py-2 text-[13.5px] font-medium transition",
                  open === group.label
                    ? "bg-pitch-800 text-white"
                    : "text-slate-300 hover:bg-pitch-800/60 hover:text-white",
                )}
              >
                {group.label}
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 opacity-60" aria-hidden>
                  <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>

              {open === group.label && (
                <div className="absolute left-0 top-full w-[340px] pt-2">
                  <div className="panel overflow-hidden p-1.5 shadow-2xl shadow-black/60">
                    {group.items.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="block rounded-lg px-3 py-2 transition hover:bg-pitch-700/70"
                      >
                        <div className="text-[13.5px] font-semibold text-white">{item.label}</div>
                        <div className="text-[11.5px] leading-tight text-slate-400">{item.desc}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>}

        <div className="ml-auto flex items-center gap-3">
          {!bare && (
            <>
          {deadline && (
            <div className="text-right">
              <div className="hidden text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:block">
                {gwLabel} deadline
              </div>
              <Countdown iso={deadline} />
            </div>
          )}
          <Link
            href="/my-team"
            className="hidden rounded-lg bg-brand-500 px-3 py-1.5 text-[13px] font-bold text-pitch-950 transition hover:bg-brand-400 sm:block"
          >
            My Team
          </Link>
          {/* Auth stays reachable at every width — hiding it on phones left no way to sign out. */}
          <div className="hidden sm:block">
            <AuthButton email={email} compact />
          </div>
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 text-slate-300 hover:bg-pitch-800 lg:hidden"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
            </>
          )}
        </div>
      </div>

      {mobileOpen && !bare && (
        <div className="max-h-[75vh] overflow-y-auto border-t border-pitch-700 bg-pitch-900 px-4 py-3 lg:hidden">
          <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-pitch-800 pb-4">
            <Link
              href="/my-team"
              className="rounded-lg bg-brand-500 px-3.5 py-2 text-[13px] font-bold text-pitch-950"
            >
              My Team
            </Link>
            <Link
              href="/squad"
              className="rounded-lg border border-pitch-600 px-3.5 py-2 text-[13px] font-bold text-slate-300"
            >
              Build a squad
            </Link>
            <div className="ml-auto">
              <AuthButton email={email} />
            </div>
          </div>

          {NAV.map((group) => (
            <div key={group.label} className="mb-4">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {group.label}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {group.items.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="rounded-lg bg-pitch-800/60 px-3 py-2 text-[13px] font-medium text-slate-200"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}

function Countdown({ iso }: { iso: string }) {
  const [label, setLabel] = useState("--");

  useEffect(() => {
    const tick = () => {
      const ms = new Date(iso).getTime() - Date.now();
      if (ms <= 0) return setLabel("Live");
      const s = Math.floor(ms / 1000);
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      setLabel(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s % 60}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [iso]);

  return <div className="num text-[13px] font-bold text-brand-400">{label}</div>;
}
