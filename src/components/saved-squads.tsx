"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SavedSquad } from "@/lib/supabase/squads";
import { deleteSquad, saveSquad } from "@/lib/supabase/squads";
import { AuthButton } from "./auth-button";
import { cn, money } from "@/lib/utils";

/**
 * Save/load panel for the squad builder. Signed-out users still get the full builder — the
 * squad lives in the URL — so this only adds persistence on top.
 */
export function SavedSquads({
  email,
  squads,
  current,
}: {
  email: string | null;
  squads: SavedSquad[];
  /** the squad currently in the builder, or null if it is not yet complete */
  current: {
    name: string;
    playerIds: number[];
    captainId: number | null;
    viceCaptainId: number | null;
    formation: string | null;
    bank: number;
  } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) =>
    startTransition(async () => {
      const res = await fn();
      setMessage(
        res.ok ? { tone: "ok", text: okText } : { tone: "bad", text: res.error ?? "Failed." },
      );
      if (res.ok) router.refresh();
    });

  const href = (s: SavedSquad) => {
    const q = new URLSearchParams({ squad: s.playerIds.join(",") });
    if (s.captainId) q.set("c", String(s.captainId));
    if (s.viceCaptainId) q.set("v", String(s.viceCaptainId));
    if (s.bank) q.set("bank", String(s.bank));
    if (s.name) q.set("name", s.name);
    return `/squad?${q.toString()}`;
  };

  return (
    <section className="panel px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-bold text-white">Saved squads</h2>
          <p className="text-[12px] text-slate-500">
            {email
              ? "Saved to your account and available on any device."
              : "Sign in to save squads to your account. Everything here works without one too — your squad is stored in the page address."}
          </p>
        </div>
        <AuthButton email={email} />
      </div>

      {email && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!current || pending}
              title={current ? undefined : "Complete all 15 players first"}
              onClick={() => current && run(() => saveSquad(current), "Squad saved.")}
              className="rounded-lg bg-brand-500 px-4 py-2 text-[13px] font-bold text-pitch-950 transition enabled:hover:bg-brand-400 disabled:opacity-40"
            >
              {pending ? "Saving…" : "Save current squad"}
            </button>
            {message && (
              <span
                className={cn(
                  "text-[12.5px]",
                  message.tone === "ok" ? "text-brand-400" : "text-rose-400",
                )}
              >
                {message.text}
              </span>
            )}
          </div>

          {squads.length > 0 ? (
            <ul className="mt-3 divide-y divide-pitch-800">
              {squads.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-white">{s.name}</div>
                    <div className="text-[11.5px] text-slate-500">
                      {s.formation ? `${s.formation} · ` : ""}
                      {money(s.bank)} in the bank · saved{" "}
                      {new Date(s.updatedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  </div>
                  <a
                    href={href(s)}
                    className="rounded-lg border border-pitch-600 px-3 py-1.5 text-[12.5px] font-semibold text-slate-300 transition hover:border-brand-500 hover:text-white"
                  >
                    Load
                  </a>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => deleteSquad(s.id), "Squad deleted.")}
                    className="px-1 text-[12.5px] text-slate-600 transition hover:text-rose-400 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[12.5px] text-slate-500">
              No saved squads yet. Build one below and hit save.
            </p>
          )}
        </>
      )}
    </section>
  );
}
