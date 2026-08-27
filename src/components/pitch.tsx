import Image from "next/image";
import Link from "next/link";
import type { PlayerRow } from "@/lib/fpl/row";
import type { XI } from "@/lib/fpl/optimiser";
import { cn, money, shirtUrl } from "@/lib/utils";
import { FixtureRun, PlayerFlag } from "./ui";

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
  metricLabel = "Points",
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
      {/*
       * The FPL pitch: green, striped, and marked out like the real thing. The stripes are a
       * repeating-linear-gradient rather than an image so it scales to any width without
       * banding, and the markings sit on top at low opacity.
       */}
      <div
        className="relative overflow-hidden rounded-t-2xl border border-b-0 border-pitch-700 px-1.5 pb-3 pt-4 sm:px-3"
        style={{
          backgroundColor: "#0e8a44",
          backgroundImage:
            "repeating-linear-gradient(180deg,rgba(255,255,255,.055) 0 42px,transparent 42px 84px)," +
            "linear-gradient(180deg,#12a352 0%,#0e8a44 55%,#0a6f37 100%)",
        }}
      >
        <PitchMarkings />
        <div className="relative space-y-3 sm:space-y-4">
          {rows.map((line, i) => (
            <div key={i} className="flex flex-wrap items-start justify-center gap-x-1 gap-y-3 sm:gap-x-3">
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

      {/* FPL puts the bench on its own paler strip directly under the pitch, not a separate card. */}
      <div
        className="rounded-b-2xl border border-t-0 border-pitch-700 px-1.5 pb-3 pt-2.5 sm:px-3"
        style={{ backgroundColor: "#0a5c2f" }}
      >
        <div className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.14em] text-white/60">
          Bench
        </div>
        <div className="flex flex-wrap items-start justify-center gap-x-1 gap-y-3 sm:gap-x-3">
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
      className="group relative w-[62px] shrink-0 text-center sm:w-[80px] md:w-[94px]"
      title={player.news || undefined}
    >
      <div className="relative mx-auto h-[46px] w-[42px] sm:h-[54px] sm:w-[50px]">
        <Image
          src={shirtUrl(teamCode, player.posId === 1)}
          alt=""
          width={50}
          height={54}
          unoptimized
          className={cn(
            "h-full w-full object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,.35)] transition group-hover:-translate-y-0.5",
            unavailable && "opacity-55",
          )}
        />
        {isCaptain && <Armband label="C" />}
        {!isCaptain && isVice && <Armband label="V" muted />}
        {benchOrder && (
          <span className="absolute -left-1.5 top-0 grid h-[17px] w-[17px] place-items-center rounded-full bg-white/85 text-[9px] font-black text-[#37003c]">
            {benchOrder}
          </span>
        )}
        {/* Graded by chance of playing, so a 75% doubt reads differently from a player who is out. */}
        <PlayerFlag
          status={player.status}
          news={player.news}
          availability={player.availability}
          className="absolute -right-1.5 top-0 rounded-full bg-pitch-950/85 px-1 py-0.5 ring-1 ring-black/30"
        />
      </div>

      {/* FPL's two-tone card: purple name plate over a mint stat plate. */}
      <div className="mt-1 overflow-hidden rounded-[3px] shadow-[0_1px_2px_rgba(0,0,0,.3)]">
        <div
          className="truncate px-1 py-[3px] text-[10.5px] font-bold leading-tight text-white sm:text-[11.5px]"
          style={{ backgroundColor: "#37003c" }}
        >
          {player.name}
        </div>
        <div
          className="num truncate px-1 py-[2px] text-[10px] font-black leading-tight sm:text-[11px]"
          style={{ backgroundColor: "#00ff87", color: "#37003c" }}
        >
          {Number.isFinite(value) ? value.toFixed(metric === "cost" ? 1 : 2) : "—"}
        </div>
      </div>
      <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/70">
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

/**
 * Only the top half of a pitch is drawn — the XI is laid out keeper-first from the top, so
 * the goal, box and centre circle land where the eye expects them. preserveAspectRatio is
 * "none" deliberately: the markings stretch with the card rather than boxing its height.
 */
function PitchMarkings() {
  return (
    <svg
      viewBox="0 0 340 420"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.38]"
      aria-hidden
    >
      <g fill="none" stroke="#fff" strokeWidth="2">
        <rect x="5" y="5" width="330" height="410" />
        {/* penalty box, six-yard box and spot at the defending end */}
        <rect x="88" y="5" width="164" height="66" />
        <rect x="132" y="5" width="76" height="28" />
        <circle cx="170" cy="52" r="1.8" fill="#fff" />
        {/* the D */}
        <path d="M132 71 A 44 44 0 0 0 208 71" />
        {/* halfway line and centre circle at the bottom edge of the card */}
        <line x1="5" y1="415" x2="335" y2="415" />
        <circle cx="170" cy="415" r="52" />
      </g>
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
            <th className="text-right">Points</th>
            <th className="text-right">Next 5</th>
            <th className="text-right">Minutes</th>
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
                  <PlayerFlag
                    status={p.status}
                    news={p.news}
                    availability={p.availability}
                    showPct
                  />
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
