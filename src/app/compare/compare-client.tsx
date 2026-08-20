"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlayerRow } from "@/lib/fpl/data";
import { FixtureRun, PositionBadge } from "@/components/ui";
import { cn, money, photoUrl } from "@/lib/utils";

const METRICS: { key: keyof PlayerRow; label: string; format?: (v: number) => string; invert?: boolean; group: string }[] = [
  { key: "xPtsNext", label: "xPts next GW", format: (v) => v.toFixed(2), group: "Projection" },
  { key: "xPts", label: "xPts next 5", format: (v) => v.toFixed(1), group: "Projection" },
  { key: "value", label: "xPts per £m", format: (v) => v.toFixed(2), group: "Projection" },
  { key: "rating", label: "Rating /10", format: (v) => v.toFixed(1), group: "Projection" },
  { key: "xMins", label: "Projected minutes", group: "Projection" },
  { key: "fdr", label: "Avg fixture difficulty", format: (v) => v.toFixed(2), invert: true, group: "Projection" },

  { key: "totalPoints", label: "Total points", group: "Season" },
  { key: "ppg", label: "Points per game", format: (v) => v.toFixed(1), group: "Season" },
  { key: "form", label: "Form", format: (v) => v.toFixed(1), group: "Season" },
  { key: "minutes", label: "Minutes", group: "Season" },
  { key: "starts", label: "Starts", group: "Season" },
  { key: "bonus", label: "Bonus points", group: "Season" },
  { key: "bps", label: "BPS", group: "Season" },

  { key: "goals", label: "Goals", group: "Attack" },
  { key: "assists", label: "Assists", group: "Attack" },
  { key: "xG90", label: "xG per 90", format: (v) => v.toFixed(2), group: "Attack" },
  { key: "xA90", label: "xA per 90", format: (v) => v.toFixed(2), group: "Attack" },
  { key: "xGI90", label: "xGI per 90", format: (v) => v.toFixed(2), group: "Attack" },
  { key: "threat", label: "Threat", format: (v) => v.toFixed(0), group: "Attack" },
  { key: "creativity", label: "Creativity", format: (v) => v.toFixed(0), group: "Attack" },

  { key: "cleanSheets", label: "Clean sheets", group: "Defence" },
  { key: "xGC90", label: "xGC per 90", format: (v) => v.toFixed(2), invert: true, group: "Defence" },
  { key: "dc90", label: "Defensive actions /90", format: (v) => v.toFixed(1), group: "Defence" },
  { key: "saves", label: "Saves", group: "Defence" },

  { key: "selectedBy", label: "Ownership %", format: (v) => `${v.toFixed(1)}%`, group: "Market" },
  { key: "netTransfers", label: "Net transfers this GW", format: (v) => v.toLocaleString("en-GB"), group: "Market" },
  { key: "costChangeStart", label: "Price change", format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`, group: "Market" },
];

const GROUPS = ["Projection", "Season", "Attack", "Defence", "Market"];

export function CompareClient({ rows, initialIds }: { rows: PlayerRow[]; initialIds: number[] }) {
  const [selected, setSelected] = useState<number[]>(initialIds.slice(0, 4));
  const [query, setQuery] = useState("");

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const players = selected.map((id) => byId.get(id)).filter(Boolean) as PlayerRow[];

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return rows
      .filter(
        (r) =>
          !selected.includes(r.id) &&
          (r.fullName.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 8);
  }, [rows, query, selected]);

  const add = (id: number) => {
    setSelected((s) => (s.length >= 4 || s.includes(id) ? s : [...s, id]));
    setQuery("");
  };
  const remove = (id: number) => setSelected((s) => s.filter((x) => x !== id));

  return (
    <div>
      <div className="panel relative mb-5 px-4 py-3.5">
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Add a player {players.length ? `(${players.length}/4)` : ""}
        </label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any player…"
          disabled={players.length >= 4}
          className="h-10 w-full max-w-md rounded-lg border border-pitch-700 bg-pitch-900 px-3 text-[14px] outline-none placeholder:text-slate-600 focus:border-brand-500 disabled:opacity-50"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full max-w-md overflow-hidden rounded-lg border border-pitch-600 bg-pitch-850 shadow-2xl shadow-black/60">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => add(s.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-pitch-700"
                >
                  <PositionBadge pos={s.pos} />
                  <span className="text-[13.5px] font-semibold text-white">{s.name}</span>
                  <span className="text-[11.5px] text-slate-500">{s.team}</span>
                  <span className="num ml-auto text-[12px] text-slate-400">{money(s.cost)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!players.length ? (
        <div className="panel px-6 py-14 text-center text-[13.5px] text-slate-400">
          Search for two or more players to compare them side by side.
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-pitch-700">
                <th className="w-48 px-4 py-3 text-left text-[10.5px] uppercase tracking-wide text-slate-500">
                  Metric
                </th>
                {players.map((p) => (
                  <th key={p.id} className="px-3 py-3 align-top">
                    <div className="flex flex-col items-center gap-1.5">
                      <Image
                        src={photoUrl(p.code)}
                        alt=""
                        width={44}
                        height={56}
                        unoptimized
                        className="h-[56px] w-[44px] rounded bg-pitch-800 object-cover"
                      />
                      <Link
                        href={`/players/${p.id}`}
                        className="text-[13.5px] font-bold text-white hover:text-brand-400"
                      >
                        {p.name}
                      </Link>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <PositionBadge pos={p.pos} />
                        {p.team} · {money(p.cost)}
                      </div>
                      <FixtureRun fixtures={p.fixtures} max={4} />
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        className="text-[11px] text-slate-600 transition hover:text-rose-400"
                      >
                        Remove
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((group) => (
                <GroupRows key={group} group={group} players={players} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GroupRows({ group, players }: { group: string; players: PlayerRow[] }) {
  const metrics = METRICS.filter((m) => m.group === group);
  return (
    <>
      <tr className="bg-pitch-800/50">
        <td
          colSpan={players.length + 1}
          className="px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-brand-400"
        >
          {group}
        </td>
      </tr>
      {metrics.map((m) => {
        const values = players.map((p) => Number(p[m.key]));
        const best = m.invert ? Math.min(...values) : Math.max(...values);
        const worst = m.invert ? Math.max(...values) : Math.min(...values);
        return (
          <tr key={String(m.key)} className="border-b border-pitch-800/60">
            <td className="px-4 py-1.5 text-slate-400">{m.label}</td>
            {players.map((p, i) => {
              const v = values[i];
              const isBest = players.length > 1 && v === best && best !== worst;
              return (
                <td
                  key={p.id}
                  className={cn(
                    "num px-3 py-1.5 text-center font-semibold",
                    isBest ? "bg-brand-500/12 text-brand-400" : "text-slate-200",
                  )}
                >
                  {m.format ? m.format(v) : Number.isInteger(v) ? v : v.toFixed(1)}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
