import Image from "next/image";
import Link from "next/link";
import type { PlayerRow } from "@/lib/fpl/row";
import type { XI } from "@/lib/fpl/optimiser";
import { cn, money, shirtUrl } from "@/lib/utils";
import { FixtureRun } from "./ui";

export interface PitchProps {
  xi: XI;
  /** field of the row shown under each shirt */
  metric?: keyof PlayerRow;
  metricLabel?: string;
  /** override captain/vice from the manager's real picks */
  captainId?: number;
  viceCaptainId?: number;
  teamCodes: Record<number, number>;
}

export function Pitch({
  xi,
  metric = "xPtsNext",
  metricLabel = "xPts",
  captainId,
  viceCaptainId,
  teamCodes,
}: PitchProps) {
  const captain = captainId ?? xi.captain?.id;
  const vice = viceCaptainId ?? xi.viceCaptain?.id;

  const rows: PlayerRow[][] = [
    xi.starters.filter((p) => p.posId === 1),
    xi.starters.filter((p) => p.posId === 2),
    xi.starters.filter((p) => p.posId === 3),
    xi.starters.filter((p) => p.posId === 4),
  ];

  return (
    <div>
      <div
        className="relative overflow-hidden rounded-2xl border border-pitch-700 px-2 py-5"
        style={{
          background:
            "linear-gradient(180deg,#0d2a1c 0%,#0f3323 45%,#0b2418 100%)",
        }}
      >
        <PitchMarkings />
        <div className="relative space-y-5">
          {rows.map((line, i) => (
            <div key={i} className="flex flex-wrap items-start justify-center gap-x-1 gap-y-4 sm:gap-x-2">
              {line.map((p) => (
                <Shirt
                  key={p.id}
                  player={p}
                  metric={metric}
                  metricLabel={metricLabel}
                  isCaptain={p.id === captain}
                  isVice={p.id === vice}
                  teamCode={teamCodes[p.teamId] ?? 1}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-pitch-700 bg-pitch-850 px-2 py-4">
        <div className="mb-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Bench
        </div>
        <div className="flex flex-wrap items-start justify-center gap-x-1 gap-y-4 sm:gap-x-2">
          {xi.bench.map((p, i) => (
            <Shirt
              key={p.id}
              player={p}
              metric={metric}
              metricLabel={metricLabel}
              benchOrder={p.posId === 1 ? "GK" : String(i + 1)}
              teamCode={teamCodes[p.teamId] ?? 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Shirt({
  player,
  metric,
  metricLabel,
  isCaptain,
  isVice,
  benchOrder,
  teamCode,
}: {
  player: PlayerRow;
  metric: keyof PlayerRow;
  metricLabel: string;
  isCaptain?: boolean;
  isVice?: boolean;
  benchOrder?: string;
  teamCode: number;
}) {
  const value = Number(player[metric]);
  const unavailable = player.status !== "a";

  return (
    <Link
      href={`/players/${player.id}`}
      className="group relative w-[60px] shrink-0 text-center sm:w-[78px] md:w-[92px]"
      title={player.news || undefined}
    >
      <div className="relative mx-auto h-[48px] w-[42px]">
        <Image
          src={shirtUrl(teamCode, player.posId === 1)}
          alt=""
          width={42}
          height={48}
          unoptimized
          className={cn("h-full w-full object-contain transition group-hover:scale-110", unavailable && "opacity-55")}
        />
        {isCaptain && <Armband label="C" />}
        {!isCaptain && isVice && <Armband label="V" muted />}
        {benchOrder && (
          <span className="absolute -left-1 top-0 rounded bg-pitch-700 px-1 text-[9px] font-bold text-slate-400">
            {benchOrder}
          </span>
        )}
        {unavailable && (
          <span
            className={cn(
              "absolute -right-1 top-0 grid h-3.5 w-3.5 place-items-center rounded-full text-[8px] font-black text-white",
              player.status === "d" ? "bg-amber-500" : "bg-rose-500",
            )}
          >
            !
          </span>
        )}
      </div>

      <div className="mt-1 truncate rounded-t bg-pitch-950/85 px-1 text-[11px] font-bold text-white">
        {player.name}
      </div>
      <div className="num truncate rounded-b bg-brand-500 px-1 text-[10.5px] font-bold text-pitch-950">
        {Number.isFinite(value) ? value.toFixed(metric === "cost" ? 1 : 2) : "—"}
      </div>
      <div className="mt-0.5 text-[9.5px] uppercase tracking-wide text-slate-400">
        {player.team} · {metricLabel}
      </div>
    </Link>
  );
}

function Armband({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "absolute -right-1.5 bottom-0 grid h-[18px] w-[18px] place-items-center rounded-full border-2 text-[10px] font-black",
        muted
          ? "border-pitch-950 bg-slate-300 text-pitch-950"
          : "border-pitch-950 bg-white text-pitch-950",
      )}
    >
      {label}
    </span>
  );
}

function PitchMarkings() {
  return (
    <svg
      viewBox="0 0 340 420"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
      aria-hidden
    >
      <rect x="6" y="6" width="328" height="408" fill="none" stroke="#fff" strokeWidth="1.5" />
      <line x1="6" y1="210" x2="334" y2="210" stroke="#fff" strokeWidth="1.5" />
      <circle cx="170" cy="210" r="46" fill="none" stroke="#fff" strokeWidth="1.5" />
      <rect x="90" y="6" width="160" height="62" fill="none" stroke="#fff" strokeWidth="1.5" />
      <rect x="90" y="352" width="160" height="62" fill="none" stroke="#fff" strokeWidth="1.5" />
      <rect x="132" y="6" width="76" height="26" fill="none" stroke="#fff" strokeWidth="1.5" />
      <rect x="132" y="388" width="76" height="26" fill="none" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

export function SquadList({
  players,
  teamCodes,
}: {
  players: PlayerRow[];
  teamCodes: Record<number, number>;
}) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[720px] text-[13px]">
        <thead>
          <tr className="border-b border-pitch-700 text-[10.5px] uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2 text-left">Player</th>
            <th className="text-right">£</th>
            <th className="text-right">xPts GW</th>
            <th className="text-right">xPts run</th>
            <th className="text-right">xMins</th>
            <th className="text-right">Rating</th>
            <th className="px-3 text-left">Fixtures</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className="border-b border-pitch-800/60 hover:bg-pitch-800/40">
              <td className="px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <Image
                    src={shirtUrl(teamCodes[p.teamId] ?? 1, p.posId === 1)}
                    alt=""
                    width={18}
                    height={21}
                    unoptimized
                    className="h-[21px] w-[18px] object-contain"
                  />
                  <Link href={`/players/${p.id}`} className="font-semibold text-white hover:text-brand-400">
                    {p.name}
                  </Link>
                  <span className="text-[11px] text-slate-500">
                    {p.pos} · {p.team}
                  </span>
                </div>
              </td>
              <td className="num pr-1 text-right text-slate-300">{money(p.cost)}</td>
              <td className="num pr-1 text-right font-bold text-brand-400">
                {p.xPtsNext.toFixed(2)}
              </td>
              <td className="num pr-1 text-right text-slate-300">{p.xPts.toFixed(1)}</td>
              <td className="num pr-1 text-right text-slate-400">{p.xMins}</td>
              <td className="num pr-1 text-right text-slate-300">{p.rating.toFixed(1)}</td>
              <td className="px-3 py-1.5">
                <FixtureRun fixtures={p.fixtures} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
