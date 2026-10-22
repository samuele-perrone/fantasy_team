import Image from "next/image";
import { cn, DIFFICULTY_STYLES, photoUrl, POSITION_STYLES } from "@/lib/utils";
import type { FixtureChip } from "@/lib/fpl/data";
import type { OtherGame } from "@/lib/fpl/row";

export function PageHeader({
  eyebrow,
  title,
  description,
  badge,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  /** short highlight beside the eyebrow, e.g. an active chip */
  badge?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {(eyebrow || badge) && (
          <div className="mb-1 flex items-center gap-2">
            {eyebrow && (
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-400">
                {eyebrow}
              </span>
            )}
            {badge && (
              <span className="rounded bg-accent-500/20 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-accent-400">
                {badge}
              </span>
            )}
          </div>
        )}
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-[24px]">{title}</h1>
        {description && (
          <p className="mt-0.5 max-w-3xl text-[12.5px] leading-snug text-slate-400">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function PositionBadge({ pos, className }: { pos: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] items-center rounded px-1.5 text-[10px] font-bold ring-1 ring-inset",
        POSITION_STYLES[pos] ?? "bg-slate-500/15 text-slate-300 ring-slate-500/30",
        className,
      )}
    >
      {pos}
    </span>
  );
}

export function DifficultyPill({
  difficulty,
  children,
  title,
  className,
}: {
  difficulty: number;
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-[22px] min-w-[46px] items-center justify-center rounded px-1 text-[11px] font-bold",
        DIFFICULTY_STYLES[difficulty] ?? DIFFICULTY_STYLES[3],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A player's headshot in a circle. FPL has no photo for some new signings, so the initials sit
 * underneath: a missing image (alt="") draws nothing and they show through.
 */
export function PlayerPhoto({
  code,
  name,
  size = 40,
  className,
}: {
  code: number;
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-pitch-800 text-[11px] font-bold text-slate-400 ring-1 ring-pitch-700",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initials}
      <Image
        src={photoUrl(code)}
        alt=""
        width={size}
        height={size}
        sizes={`${size}px`}
        className="absolute inset-0 h-full w-full object-cover object-top"
      />
    </span>
  );
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  });

/** Matches outside the Premier League, one line each: "Tue 4 Nov · Champions League v Inter (A)". */
export function OtherGames({ games }: { games: OtherGame[] }) {
  return (
    <ul className="space-y-0.5">
      {games.map((g) => (
        <li key={`${g.kickoff}-${g.opponent}`} className="text-[12.5px] leading-snug text-slate-300">
          <span className="text-slate-500">{shortDate(g.kickoff)} · </span>
          {g.competition} v {g.opponent}
          <span className="text-slate-500"> ({g.isHome ? "H" : "A"})</span>
        </li>
      ))}
    </ul>
  );
}

export function FixtureRun({ fixtures, max = 5 }: { fixtures: FixtureChip[]; max?: number }) {
  if (!fixtures.length) {
    return <span className="text-[11px] text-slate-600">Blank</span>;
  }
  return (
    <div className="flex gap-[3px]">
      {fixtures.slice(0, max).map((f, i) => (
        <DifficultyPill
          key={`${f.event}-${f.opponentId}-${i}`}
          difficulty={f.difficulty}
          title={`GW${f.event} · ${f.isHome ? "vs" : "at"} ${f.opponent} · difficulty ${f.difficulty}/5 · ${f.xPts.toFixed(1)} pts${f.congested ? " · three games in seven days" : ""}`}
          className={f.congested ? "relative" : undefined}
        >
          {f.opponent}
          {f.isHome ? "" : " (a)"}
          {f.congested && (
            <span
              aria-label="Three games in seven days"
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-pitch-950"
            />
          )}
        </DifficultyPill>
      ))}
    </div>
  );
}

/**
 * The availability flag FPL puts beside a player's name.
 *
 * Colour follows the *chance of playing*, not the status code, because that is what the game
 * itself grades: 75% is a yellow flag, 50% and 25% deepen through amber to orange, and anything
 * at 0 — injured, suspended, or simply unavailable — is red. A player with no chance published
 * but a non-available status is treated as red rather than silently unflagged.
 */
export function PlayerFlag({
  status,
  news,
  availability,
  className,
  showPct = false,
}: {
  status: string;
  news: string;
  availability: number | null;
  className?: string;
  /** print the percentage next to the flag, where there is room for it */
  showPct?: boolean;
}) {
  if (status === "a" && (availability === null || availability >= 100)) return null;

  const pct = availability;
  const tone =
    pct === null || pct <= 0
      ? "text-rose-500"
      : pct <= 25
        ? "text-orange-500"
        : pct <= 50
          ? "text-amber-500"
          : "text-yellow-400";

  const label =
    news ||
    (pct === null || pct <= 0
      ? "Unavailable"
      : `${pct}% chance of playing`);

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-0.5", tone, className)} title={label}>
      <svg width="9" height="11" viewBox="0 0 12 14" aria-hidden className="shrink-0">
        <path d="M2 0.5v13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M3.2 1.2h7.6L8.9 4l1.9 2.8H3.2z" fill="currentColor" />
      </svg>
      {showPct && pct !== null && pct > 0 && (
        <span className="num text-[9.5px] font-bold leading-none">{pct}</span>
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}
