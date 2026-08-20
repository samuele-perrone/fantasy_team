"use client";

import { useMemo, useState } from "react";
import type { PlayerRow } from "@/lib/fpl/data";
import { cn, heatStyle, money } from "@/lib/utils";
import { FixtureRun, PlayerLink, PositionBadge, StatusDot } from "./ui";

type Align = "left" | "right";

interface Column {
  key: string;
  label: string;
  title?: string;
  align?: Align;
  width?: string;
  value: (r: PlayerRow) => number | string;
  render?: (r: PlayerRow) => React.ReactNode;
  heat?: boolean;
  /** higher is better — drives the heat map direction */
  invert?: boolean;
}

const n = (v: number, d = 1) => v.toFixed(d);

const COLUMN_GROUPS: Record<string, { label: string; columns: Column[] }> = {
  predictions: {
    label: "Predictions",
    columns: [
      { key: "xPtsNext", label: "xPts", title: "Projected points, next gameweek", align: "right", value: (r) => r.xPtsNext, render: (r) => <span className="font-bold text-brand-400">{n(r.xPtsNext, 2)}</span>, heat: true },
      { key: "xPts", label: "xPts (run)", title: "Projected points over the selected horizon", align: "right", value: (r) => r.xPts, render: (r) => n(r.xPts, 1), heat: true },
      { key: "xMins", label: "xMins", title: "Projected minutes next gameweek", align: "right", value: (r) => r.xMins, render: (r) => String(r.xMins) },
      { key: "startProb", label: "Start%", title: "Probability of starting", align: "right", value: (r) => r.startProb, render: (r) => `${Math.round(r.startProb * 100)}%` },
      { key: "rating", label: "Rating", title: "Composite 0–10 rating", align: "right", value: (r) => r.rating, render: (r) => <Rating value={r.rating} />, heat: true },
      { key: "value", label: "Value", title: "Projected points per £m over the horizon", align: "right", value: (r) => r.value, render: (r) => n(r.value, 2), heat: true },
    ],
  },
  form: {
    label: "Season",
    columns: [
      { key: "totalPoints", label: "Pts", align: "right", value: (r) => r.totalPoints, heat: true },
      { key: "form", label: "Form", align: "right", value: (r) => r.form, render: (r) => n(r.form, 1), heat: true },
      { key: "ppg", label: "PPG", align: "right", value: (r) => r.ppg, render: (r) => n(r.ppg, 1), heat: true },
      { key: "minutes", label: "Mins", align: "right", value: (r) => r.minutes },
      { key: "starts", label: "Starts", align: "right", value: (r) => r.starts },
      { key: "bonus", label: "Bonus", align: "right", value: (r) => r.bonus, heat: true },
      { key: "bps", label: "BPS", align: "right", value: (r) => r.bps },
    ],
  },
  attack: {
    label: "Attack",
    columns: [
      { key: "goals", label: "G", align: "right", value: (r) => r.goals, heat: true },
      { key: "assists", label: "A", align: "right", value: (r) => r.assists, heat: true },
      { key: "xG", label: "xG", align: "right", value: (r) => r.xG, render: (r) => n(r.xG, 2), heat: true },
      { key: "xA", label: "xA", align: "right", value: (r) => r.xA, render: (r) => n(r.xA, 2), heat: true },
      { key: "xG90", label: "xG/90", align: "right", value: (r) => r.xG90, render: (r) => n(r.xG90, 2), heat: true },
      { key: "xA90", label: "xA/90", align: "right", value: (r) => r.xA90, render: (r) => n(r.xA90, 2), heat: true },
      { key: "xGI90", label: "xGI/90", align: "right", value: (r) => r.xGI90, render: (r) => n(r.xGI90, 2), heat: true },
      { key: "threat", label: "Threat", align: "right", value: (r) => r.threat, render: (r) => n(r.threat, 0) },
      { key: "creativity", label: "Creat", align: "right", value: (r) => r.creativity, render: (r) => n(r.creativity, 0) },
    ],
  },
  defence: {
    label: "Defence",
    columns: [
      { key: "cleanSheets", label: "CS", align: "right", value: (r) => r.cleanSheets, heat: true },
      { key: "xGC90", label: "xGC/90", title: "Expected goals conceded per 90", align: "right", value: (r) => r.xGC90, render: (r) => n(r.xGC90, 2), invert: true, heat: true },
      { key: "dc", label: "DC", title: "Defensive contribution actions", align: "right", value: (r) => r.dc, heat: true },
      { key: "dc90", label: "DC/90", title: "Defensive contribution per 90 — 10 for DEF / 12 for MID & FWD scores 2pts", align: "right", value: (r) => r.dc90, render: (r) => <DcCell row={r} />, heat: true },
      { key: "saves", label: "Saves", align: "right", value: (r) => r.saves },
      { key: "yellowCards", label: "YC", align: "right", value: (r) => r.yellowCards, invert: true },
    ],
  },
  ownership: {
    label: "Market",
    columns: [
      { key: "selectedBy", label: "TSB%", title: "Selected by", align: "right", value: (r) => r.selectedBy, render: (r) => `${n(r.selectedBy, 1)}%`, heat: true },
      { key: "netTransfers", label: "Net GW", title: "Net transfers this gameweek", align: "right", value: (r) => r.netTransfers, render: (r) => <Signed value={r.netTransfers} format={compact} /> },
      { key: "transfersInEvent", label: "In", align: "right", value: (r) => r.transfersInEvent, render: (r) => compact(r.transfersInEvent) },
      { key: "transfersOutEvent", label: "Out", align: "right", value: (r) => r.transfersOutEvent, render: (r) => compact(r.transfersOutEvent) },
      { key: "costChangeStart", label: "Δ Season", title: "Price change since the season started", align: "right", value: (r) => r.costChangeStart, render: (r) => <Signed value={r.costChangeStart} format={(v) => `${v.toFixed(1)}`} /> },
      { key: "setPieces", label: "Set pieces", align: "left", value: (r) => (r.penaltyOrder ?? 9) * 100 + (r.cornerOrder ?? 9) * 10 + (r.freekickOrder ?? 9), render: (r) => <SetPieces row={r} />, invert: true },
    ],
  },
};

const compact = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k` : String(v);

function Signed({ value, format }: { value: number; format: (v: number) => string }) {
  if (value === 0) return <span className="text-slate-600">0</span>;
  return (
    <span className={value > 0 ? "text-brand-400" : "text-rose-400"}>
      {value > 0 ? "+" : "−"}
      {format(Math.abs(value))}
    </span>
  );
}

function Rating({ value }: { value: number }) {
  const tone =
    value >= 7.5 ? "bg-brand-500 text-pitch-950" : value >= 5.5 ? "bg-brand-500/25 text-brand-300" : "bg-pitch-700 text-slate-400";
  return (
    <span className={cn("num inline-block w-[38px] rounded px-1 py-[2px] text-center text-[11.5px] font-bold", tone)}>
      {value.toFixed(1)}
    </span>
  );
}

function DcCell({ row }: { row: PlayerRow }) {
  const threshold = row.posId === 2 ? 10 : row.posId === 1 ? 0 : 12;
  if (!threshold) return <span className="text-slate-600">–</span>;
  const hit = row.dc90 >= threshold;
  return (
    <span className={hit ? "font-bold text-brand-400" : ""}>{row.dc90.toFixed(1)}</span>
  );
}

function SetPieces({ row }: { row: PlayerRow }) {
  const marks = [
    row.penaltyOrder && row.penaltyOrder <= 2 ? { l: "PK", o: row.penaltyOrder } : null,
    row.freekickOrder && row.freekickOrder <= 2 ? { l: "FK", o: row.freekickOrder } : null,
    row.cornerOrder && row.cornerOrder <= 2 ? { l: "CK", o: row.cornerOrder } : null,
  ].filter(Boolean) as { l: string; o: number }[];
  if (!marks.length) return <span className="text-slate-700">–</span>;
  return (
    <span className="flex gap-1">
      {marks.map((m) => (
        <span
          key={m.l}
          title={`${m.l} order ${m.o}`}
          className={cn(
            "rounded px-1 text-[10px] font-bold",
            m.o === 1 ? "bg-accent-500/25 text-accent-400" : "bg-pitch-700 text-slate-400",
          )}
        >
          {m.l}
          {m.o}
        </span>
      ))}
    </span>
  );
}

export interface PlayerTableProps {
  rows: PlayerRow[];
  teams: { id: number; short: string; name: string }[];
  defaultSort?: string;
  defaultGroup?: keyof typeof COLUMN_GROUPS;
  horizonLabel?: string;
  pageSize?: number;
  showGroupSwitch?: boolean;
}

export function PlayerTable({
  rows,
  teams,
  defaultSort = "xPtsNext",
  defaultGroup = "predictions",
  horizonLabel = "next 5",
  pageSize = 40,
  showGroupSwitch = true,
}: PlayerTableProps) {
  const [group, setGroup] = useState<string>(defaultGroup);
  const [sort, setSort] = useState(defaultSort);
  const [desc, setDesc] = useState(true);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState("ALL");
  const [team, setTeam] = useState("ALL");
  const [maxCost, setMaxCost] = useState(20);
  const [minMins, setMinMins] = useState(0);
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [limit, setLimit] = useState(pageSize);

  const columns = COLUMN_GROUPS[group].columns;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (pos !== "ALL" && r.pos !== pos) return false;
      if (team !== "ALL" && String(r.teamId) !== team) return false;
      if (r.cost > maxCost) return false;
      if (r.minutes < minMins) return false;
      if (hideUnavailable && (r.status === "i" || r.status === "s" || r.status === "n")) return false;
      if (q && !r.fullName.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q) && !r.team.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [rows, search, pos, team, maxCost, minMins, hideUnavailable]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort);
    const accessor: (r: PlayerRow) => number | string =
      col?.value ??
      (sort === "name"
        ? (r) => r.name
        : sort === "cost"
          ? (r) => r.cost
          : sort === "fdr"
            ? (r) => r.fdr
            : (r) => (r as unknown as Record<string, number>)[sort] ?? 0);

    return [...filtered].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      const cmp =
        typeof av === "string" || typeof bv === "string"
          ? String(av).localeCompare(String(bv))
          : av - bv;
      return desc ? -cmp : cmp;
    });
  }, [filtered, sort, desc, columns]);

  const heatRanges = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const c of columns) {
      if (!c.heat) continue;
      let min = Infinity;
      let max = -Infinity;
      for (const r of sorted.slice(0, 200)) {
        const v = Number(c.value(r));
        if (!Number.isFinite(v)) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      out[c.key] = c.invert ? [max, min] : [min, max];
    }
    return out;
  }, [sorted, columns]);

  const toggleSort = (key: string) => {
    if (sort === key) setDesc((d) => !d);
    else {
      setSort(key);
      setDesc(key !== "name");
    }
    setLimit(pageSize);
  };

  const visible = sorted.slice(0, limit);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search player or club…"
          className="h-9 w-52 rounded-lg border border-pitch-700 bg-pitch-900 px-3 text-[13px] outline-none placeholder:text-slate-600 focus:border-brand-500"
        />
        <Select value={pos} onChange={setPos} options={[["ALL", "All positions"], ["GKP", "Goalkeepers"], ["DEF", "Defenders"], ["MID", "Midfielders"], ["FWD", "Forwards"]]} />
        <Select
          value={team}
          onChange={setTeam}
          options={[["ALL", "All clubs"] as [string, string]].concat(
            teams.map((t) => [String(t.id), t.name] as [string, string]),
          )}
        />
        <label className="flex h-9 items-center gap-2 rounded-lg border border-pitch-700 bg-pitch-900 px-3 text-[12.5px] text-slate-400">
          Max {money(maxCost)}
          <input
            type="range"
            min={3.8}
            max={20}
            step={0.5}
            value={maxCost}
            onChange={(e) => setMaxCost(Number(e.target.value))}
            className="w-24 accent-brand-500"
          />
        </label>
        <label className="flex h-9 items-center gap-2 rounded-lg border border-pitch-700 bg-pitch-900 px-3 text-[12.5px] text-slate-400">
          Min mins {minMins}
          <input
            type="range"
            min={0}
            max={2500}
            step={90}
            value={minMins}
            onChange={(e) => setMinMins(Number(e.target.value))}
            className="w-20 accent-brand-500"
          />
        </label>
        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-pitch-700 bg-pitch-900 px-3 text-[12.5px] text-slate-400">
          <input
            type="checkbox"
            checked={hideUnavailable}
            onChange={(e) => setHideUnavailable(e.target.checked)}
            className="accent-brand-500"
          />
          Available only
        </label>
        <div className="ml-auto text-[12.5px] text-slate-500">
          {filtered.length} player{filtered.length === 1 ? "" : "s"}
        </div>
      </div>

      {showGroupSwitch && (
        <div className="mb-3 inline-flex flex-wrap rounded-lg border border-pitch-700 bg-pitch-900 p-0.5">
          {Object.entries(COLUMN_GROUPS).map(([key, g]) => (
            <button
              key={key}
              type="button"
              onClick={() => setGroup(key)}
              className={cn(
                "rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold transition",
                group === key ? "bg-brand-500 text-pitch-950" : "text-slate-400 hover:text-white",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-pitch-700 text-[10.5px] uppercase tracking-wide text-slate-500">
              <Th onClick={() => toggleSort("name")} active={sort === "name"} desc={desc} align="left" className="sticky left-0 z-10 bg-pitch-850 pl-3">
                Player
              </Th>
              <Th onClick={() => toggleSort("cost")} active={sort === "cost"} desc={desc} align="right">
                £
              </Th>
              {columns.map((c) => (
                <Th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  active={sort === c.key}
                  desc={desc}
                  align={c.align ?? "right"}
                  title={c.title}
                >
                  {c.label}
                </Th>
              ))}
              <Th onClick={() => toggleSort("fdr")} active={sort === "fdr"} desc={desc} align="left" title={`Fixtures — ${horizonLabel}`}>
                Fixtures
              </Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-b border-pitch-800/60 transition hover:bg-pitch-800/50">
                <td className="sticky left-0 z-10 bg-pitch-850 py-1.5 pl-3 pr-3">
                  <div className="flex items-center gap-2">
                    <PositionBadge pos={r.pos} />
                    <PlayerLink id={r.id} name={r.name} className="whitespace-nowrap" />
                    <StatusDot status={r.status} news={r.news} />
                    <span className="text-[11px] font-medium text-slate-500">{r.team}</span>
                  </div>
                </td>
                <td className="num px-2 text-right text-slate-300">{r.cost.toFixed(1)}</td>
                {columns.map((c) => {
                  const range = heatRanges[c.key];
                  const raw = c.value(r);
                  return (
                    <td
                      key={c.key}
                      className={cn(
                        "num px-2 py-1.5",
                        (c.align ?? "right") === "right" ? "text-right" : "text-left",
                      )}
                      style={
                        range && typeof raw === "number"
                          ? heatStyle(raw, range[0], range[1])
                          : undefined
                      }
                    >
                      {c.render ? c.render(r) : typeof raw === "number" ? n(raw, Number.isInteger(raw) ? 0 : 1) : raw}
                    </td>
                  );
                })}
                <td className="py-1.5 pl-2 pr-3">
                  <FixtureRun fixtures={r.fixtures} />
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={columns.length + 3} className="py-10 text-center text-slate-500">
                  No players match those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {limit < sorted.length && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + pageSize)}
            className="rounded-lg border border-pitch-700 bg-pitch-900 px-4 py-2 text-[13px] font-semibold text-slate-300 transition hover:border-brand-500 hover:text-white"
          >
            Show {Math.min(pageSize, sorted.length - limit)} more
          </button>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  desc,
  align = "right",
  className,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  desc: boolean;
  align?: Align;
  className?: string;
  title?: string;
}) {
  return (
    <th
      title={title}
      className={cn(
        "cursor-pointer select-none whitespace-nowrap px-2 py-2 font-bold transition hover:text-slate-300",
        align === "right" ? "text-right" : "text-left",
        active && "text-brand-400",
        className,
      )}
      onClick={onClick}
    >
      {children}
      {active && <span className="ml-0.5">{desc ? "▾" : "▴"}</span>}
    </th>
  );
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-pitch-700 bg-pitch-900 px-2.5 text-[13px] text-slate-300 outline-none focus:border-brand-500"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v} className="bg-pitch-900">
          {l}
        </option>
      ))}
    </select>
  );
}
