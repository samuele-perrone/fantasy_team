"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { TeamRun } from "@/lib/fpl/team-runs";
import { badgeUrl, cn, DIFFICULTY_STYLES } from "@/lib/utils";

type View = "overall" | "attack" | "defence";

const VIEWS: { value: View; label: string; help: string }[] = [
  { value: "overall", label: "Overall", help: "The official Fantasy Premier League fixture difficulty rating." },
  { value: "attack", label: "Attacking", help: "How easy each opponent is to score against — use it to time your attackers." },
  { value: "defence", label: "Clean sheets", help: "How likely each match is to end in a clean sheet — use it to time your defenders." },
];

export function FixturesClient({
  runs,
  fromEvent,
  horizon,
  maxHorizon,
}: {
  runs: TeamRun[];
  fromEvent: number;
  horizon: number;
  maxHorizon: number;
}) {
  const [view, setView] = useState<View>("overall");
  const [sortDesc, setSortDesc] = useState(false);

  const events = useMemo(
    () => Array.from({ length: horizon }, (_, i) => fromEvent + i),
    [fromEvent, horizon],
  );

  const ratingOf = (f: TeamRun["fixtures"][number]) =>
    view === "overall" ? f.difficulty : view === "attack" ? f.attackRating : f.defenceRating;

  const sorted = useMemo(() => {
    const score = (t: TeamRun) =>
      view === "overall" ? t.avgDifficulty : view === "attack" ? t.avgAttack : t.avgDefence;
    return [...runs].sort((a, b) => (sortDesc ? score(b) - score(a) : score(a) - score(b)));
  }, [runs, view, sortDesc]);

  const active = VIEWS.find((v) => v.value === view)!;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-pitch-700 bg-pitch-900 p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setView(v.value)}
              className={cn(
                "rounded-[7px] px-3.5 py-1.5 text-[12.5px] font-semibold transition",
                view === v.value ? "bg-brand-500 text-pitch-950" : "text-slate-400 hover:text-white",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="inline-flex rounded-lg border border-pitch-700 bg-pitch-900 p-0.5">
          {[3, 5, 8, 12].filter((h) => h <= maxHorizon).map((h) => (
            <Link
              key={h}
              href={`/fixtures?from=${fromEvent}&horizon=${h}`}
              className={cn(
                "rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold transition",
                horizon === h ? "bg-pitch-600 text-white" : "text-slate-400 hover:text-white",
              )}
            >
              {h} GW
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSortDesc((d) => !d)}
          className="rounded-lg border border-pitch-700 bg-pitch-900 px-3 py-[7px] text-[12.5px] font-semibold text-slate-400 transition hover:text-white"
        >
          {sortDesc ? "Hardest first" : "Easiest first"}
        </button>

        <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-500">
          Easy
          {[1, 2, 3, 4, 5].map((d) => (
            <span key={d} className={cn("h-3.5 w-6 rounded-sm", DIFFICULTY_STYLES[d])} />
          ))}
          Hard
        </div>
      </div>

      <p className="mb-3 text-[12.5px] text-slate-500">{active.help}</p>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-pitch-700 text-[10.5px] uppercase tracking-wide text-slate-500">
              <th className="sticky left-0 z-10 bg-pitch-850 px-3 py-2 text-left">Team</th>
              {events.map((e) => (
                <th key={e} className="px-1 py-2 text-center font-bold">
                  GW{e}
                </th>
              ))}
              <th className="px-3 py-2 text-right">Avg</th>
              <th
                className="px-3 py-2 text-right"
                title={
                  view === "attack"
                    ? "Goals we expect this club to score across these fixtures"
                    : view === "defence"
                      ? "Clean sheets we expect this club to keep across these fixtures"
                      : "Goals we expect them to score minus goals we expect them to concede"
                }
              >
                {view === "attack" ? "Goals" : view === "defence" ? "Clean sheets" : "Goal diff"}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const avg =
                view === "overall" ? t.avgDifficulty : view === "attack" ? t.avgAttack : t.avgDefence;
              const summary =
                view === "attack"
                  ? t.totalXGF.toFixed(1)
                  : view === "defence"
                    ? t.totalCs.toFixed(2)
                    : (t.totalXGF - t.totalXGA).toFixed(1);
              return (
                <tr key={t.id} className="border-b border-pitch-800/60 hover:bg-pitch-800/40">
                  <td className="sticky left-0 z-10 bg-pitch-850 px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <Image
                        src={badgeUrl(t.code)}
                        alt=""
                        width={18}
                        height={18}
                        unoptimized
                        className="h-[18px] w-[18px]"
                      />
                      <span className="whitespace-nowrap font-bold text-white">{t.name}</span>
                    </div>
                  </td>
                  {events.map((e) => {
                    const fixtures = t.byEvent[e] ?? [];
                    if (!fixtures.length) {
                      return (
                        <td key={e} className="px-1 py-1.5 text-center">
                          <span className="inline-flex h-[26px] w-full min-w-[54px] items-center justify-center rounded bg-pitch-800 text-[10.5px] font-bold text-slate-600">
                            BLANK
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td key={e} className="px-1 py-1.5">
                        <div className="flex flex-col gap-0.5">
                          {fixtures.map((f, i) => (
                            <span
                              key={`${f.opponentId}-${i}`}
                              title={`${f.isHome ? "vs" : "away to"} ${f.opponent} · difficulty ${f.difficulty}/5 · expected to score ${f.xGF.toFixed(2)}, concede ${f.xGA.toFixed(2)} · clean sheet ${Math.round(f.csProb * 100)}%`}
                              className={cn(
                                "flex h-[26px] min-w-[54px] items-center justify-center rounded text-[11px] font-bold",
                                DIFFICULTY_STYLES[ratingOf(f)],
                              )}
                            >
                              {f.isHome ? f.opponent.toUpperCase() : f.opponent.toLowerCase()}
                            </span>
                          ))}
                          {fixtures.length > 1 && (
                            <span className="text-center text-[9px] font-bold uppercase text-accent-400">
                              Double
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="num px-3 py-1.5 text-right font-bold text-white">
                    {avg.toFixed(2)}
                  </td>
                  <td className="num px-3 py-1.5 text-right text-slate-400">{summary}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11.5px] text-slate-600">
        UPPERCASE = home fixture, lowercase = away. Hover any cell for the goals we expect and
        the chance of a clean sheet.
      </p>
    </div>
  );
}
