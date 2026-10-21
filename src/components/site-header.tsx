"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthButton } from "./auth-button";

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
      <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-4">
        <Link href="/squad" className="flex shrink-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-[11px] font-black tracking-tight text-pitch-950">
            FTH
          </span>
          <span className="text-[15px] font-bold tracking-tight">
            Fantasy<span className="text-brand-400">Team</span>Hub
          </span>
        </Link>

        {!bare && (
          <div className="ml-auto flex items-center gap-3">
            {deadline && (
              <div className="text-right">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {gwLabel} deadline
                </div>
                <Countdown iso={deadline} />
              </div>
            )}
            <AuthButton email={email} compact />
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
