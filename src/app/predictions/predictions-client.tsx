"use client";

import { useMemo, useState } from "react";
import type { PlayerRow } from "@/lib/fpl/data";
import { PlayerTable } from "@/components/player-table";
import { cn } from "@/lib/utils";

const HORIZONS = [1, 3, 5, 8];

/**
 * Per-fixture projections are shipped once for the full 8-gameweek horizon, so changing
 * the horizon is a pure client-side re-slice rather than another round trip.
 */
export function PredictionsClient({
  rows,
  teams,
  nextEvent,
}: {
  rows: PlayerRow[];
  teams: { id: number; short: string; name: string }[];
  nextEvent: number;
}) {
  const [horizon, setHorizon] = useState(5);

  const sliced = useMemo(() => {
    if (horizon === 8) return rows;
    return rows.map((r) => {
      const fixtures = r.fixtures.filter((f) => f.event < nextEvent + horizon);
      const xPts = fixtures.reduce((a, f) => a + f.xPts, 0);
      const fdr = fixtures.length
        ? fixtures.reduce((a, f) => a + f.difficulty, 0) / fixtures.length
        : 3;
      return {
        ...r,
        fixtures,
        xPts: Math.round(xPts * 100) / 100,
        value: Math.round((xPts / r.cost) * 100) / 100,
        fdr: Math.round(fdr * 100) / 100,
      };
    });
  }, [rows, horizon, nextEvent]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-[12.5px] font-semibold text-slate-400">Projection horizon</span>
        <div className="inline-flex rounded-lg border border-pitch-700 bg-pitch-900 p-0.5">
          {HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHorizon(h)}
              className={cn(
                "rounded-[7px] px-3.5 py-1.5 text-[12.5px] font-semibold transition",
                horizon === h ? "bg-brand-500 text-pitch-950" : "text-slate-400 hover:text-white",
              )}
            >
              {h === 1 ? "Next GW" : `${h} GWs`}
            </button>
          ))}
        </div>
        <span className="text-[12px] text-slate-500">
          GW{nextEvent}
          {horizon > 1 ? `–${nextEvent + horizon - 1}` : ""}
        </span>
      </div>

      <PlayerTable
        rows={sliced}
        teams={teams}
        defaultGroup="predictions"
        defaultSort={horizon === 1 ? "xPtsNext" : "xPts"}
        horizonLabel={`next ${horizon}`}
        key={horizon}
      />
    </div>
  );
}
