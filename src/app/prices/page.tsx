import type { Metadata } from "next";
import Image from "next/image";
import { getGameData, getPlayerRows, type PlayerRow } from "@/lib/fpl/data";
import { PageHeader, PlayerLink, PositionBadge, StatCard } from "@/components/ui";
import { badgeUrl, cn, money } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Price Changes",
  description:
    "Predicted Fantasy Premier League price risers and fallers tonight, plus season-long price movement and net transfer momentum.",
};

/**
 * FPL never publishes the real price-change formula. The accepted community model is that a
 * player moves when their net transfers cross a threshold proportional to their ownership,
 * so progress is measured as net transfers over that ownership-scaled threshold.
 */
function priceProgress(row: PlayerRow, totalPlayers: number): number {
  const owners = Math.max((row.selectedBy / 100) * totalPlayers, 1000);
  const threshold = owners * 0.09 + totalPlayers * 0.0016;
  return row.netTransfers / threshold;
}

export default async function PricesPage() {
  const [data, rows] = await Promise.all([getGameData(), getPlayerRows(5)]);
  const total = data.bootstrap.total_players || 1;

  const scored = rows
    .map((r) => ({ row: r, progress: priceProgress(r, total) }))
    .filter((x) => Number.isFinite(x.progress));

  const risers = [...scored].sort((a, b) => b.progress - a.progress).slice(0, 20);
  const fallers = [...scored].sort((a, b) => a.progress - b.progress).slice(0, 20);

  const seasonRisers = [...rows].sort((a, b) => b.costChangeStart - a.costChangeStart).slice(0, 12);
  const seasonFallers = [...rows].sort((a, b) => a.costChangeStart - b.costChangeStart).slice(0, 12);

  const imminentUp = risers.filter((r) => r.progress >= 0.9).length;
  const imminentDown = fallers.filter((r) => r.progress <= -0.9).length;
  const marketActive = rows.reduce((a, r) => a + r.transfersInEvent, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Toolbox"
        title="Price Changes"
        description="Who is about to rise or fall tonight. Progress is net transfers this gameweek measured against an ownership-scaled threshold — at 100% a change is imminent, and anything past that is very likely to move at the 01:30 BST update."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Rises predicted" value={imminentUp} sub="At or past threshold" tone="brand" />
        <StatCard label="Falls predicted" value={imminentDown} sub="At or past threshold" tone="warn" />
        <StatCard
          label="Transfers this GW"
          value={marketActive.toLocaleString("en-GB")}
          sub="Total moves in across the game"
        />
        <StatCard
          label="Biggest riser this season"
          value={seasonRisers[0] ? `+${seasonRisers[0].costChangeStart.toFixed(1)}` : "—"}
          sub={seasonRisers[0]?.name}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PriceTable
          title="Predicted risers tonight"
          tone="up"
          rows={risers}
          teams={data.teams}
        />
        <PriceTable
          title="Predicted fallers tonight"
          tone="down"
          rows={fallers}
          teams={data.teams}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SeasonTable title="Biggest season risers" rows={seasonRisers} tone="up" />
        <SeasonTable title="Biggest season fallers" rows={seasonFallers} tone="down" />
      </div>

      <p className="mt-6 text-[11.5px] leading-relaxed text-slate-600">
        Price changes are locked at 01:30 UK time. A player can only fall below their purchase
        price by the amount they have risen since, and you always sell at the midpoint of purchase
        price and current price when a player has risen an odd number of times.
      </p>
    </div>
  );
}

function PriceTable({
  title,
  rows,
  tone,
  teams,
}: {
  title: string;
  rows: { row: PlayerRow; progress: number }[];
  tone: "up" | "down";
  teams: Map<number, { code: number }>;
}) {
  return (
    <section className="panel overflow-hidden">
      <h2
        className={cn(
          "border-b border-pitch-800 px-4 py-2.5 text-[13.5px] font-bold",
          tone === "up" ? "text-brand-400" : "text-rose-400",
        )}
      >
        {title}
      </h2>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-pitch-800 text-[10px] uppercase tracking-wide text-slate-500">
            <th className="px-4 py-1.5 text-left">Player</th>
            <th className="text-right">£</th>
            <th className="text-right">Net</th>
            <th className="w-32 px-4 text-left">Progress</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ row, progress }) => {
            const p = Math.min(Math.abs(progress), 1.35);
            return (
              <tr key={row.id} className="border-b border-pitch-800/50 hover:bg-pitch-800/40">
                <td className="px-4 py-1.5">
                  <div className="flex items-center gap-2">
                    <Image
                      src={badgeUrl(teams.get(row.teamId)?.code ?? 1)}
                      alt=""
                      width={15}
                      height={15}
                      unoptimized
                      className="h-[15px] w-[15px]"
                    />
                    <PositionBadge pos={row.pos} />
                    <PlayerLink id={row.id} name={row.name} />
                    <span className="text-[11px] text-slate-500">{row.selectedBy.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="num pr-1 text-right text-slate-300">{row.cost.toFixed(1)}</td>
                <td
                  className={cn(
                    "num pr-1 text-right font-semibold",
                    row.netTransfers >= 0 ? "text-brand-400" : "text-rose-400",
                  )}
                >
                  {row.netTransfers >= 0 ? "+" : "−"}
                  {Math.abs(Math.round(row.netTransfers / 1000))}k
                </td>
                <td className="px-4 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-pitch-700">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          tone === "up" ? "bg-brand-500" : "bg-rose-500",
                        )}
                        style={{ width: `${(p / 1.35) * 100}%` }}
                      />
                    </div>
                    <span className="num w-9 text-right text-[11px] text-slate-500">
                      {Math.round(Math.abs(progress) * 100)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function SeasonTable({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: PlayerRow[];
  tone: "up" | "down";
}) {
  return (
    <section className="panel overflow-hidden">
      <h2 className="border-b border-pitch-800 px-4 py-2.5 text-[13.5px] font-bold text-white">
        {title}
      </h2>
      <ul className="divide-y divide-pitch-800/60">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2.5 px-4 py-1.5 text-[12.5px]">
            <PositionBadge pos={r.pos} />
            <PlayerLink id={r.id} name={r.name} />
            <span className="text-[11px] text-slate-500">{r.team}</span>
            <span className="num ml-auto text-slate-400">{money(r.cost)}</span>
            <span
              className={cn(
                "num w-12 text-right font-bold",
                tone === "up" ? "text-brand-400" : "text-rose-400",
              )}
            >
              {r.costChangeStart >= 0 ? "+" : ""}
              {r.costChangeStart.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
