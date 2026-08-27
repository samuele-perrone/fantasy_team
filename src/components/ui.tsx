import Link from "next/link";
import { cn, DIFFICULTY_STYLES, POSITION_STYLES } from "@/lib/utils";
import type { FixtureChip } from "@/lib/fpl/data";

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
          title={`GW${f.event} · ${f.isHome ? "vs" : "at"} ${f.opponent} · difficulty ${f.difficulty}/5 · ${f.xPts.toFixed(1)} pts`}
        >
          {f.opponent}
          {f.isHome ? "" : " (a)"}
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

/**
 * Hover/focus tooltip with no client JavaScript, so it can be used inside server components.
 * The trigger is a real button purely so keyboard users can reach it.
 */
export function InfoTip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        className="grid h-[15px] w-[15px] place-items-center rounded-full border border-pitch-600 text-[9.5px] font-bold leading-none text-slate-500 transition hover:border-brand-500 hover:text-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-[calc(100%+7px)] z-50 hidden w-60 -translate-x-1/2 rounded-lg border border-pitch-600 bg-pitch-850 px-3 py-2 text-left text-[11.5px] font-normal normal-case leading-relaxed tracking-normal text-slate-300 shadow-xl shadow-black/70 group-hover:block group-focus-within:block"
      >
        {children}
      </span>
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
  valueClassName,
  info,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "brand" | "warn";
  /** overrides `tone` — used for data-driven colours like the rating bands */
  valueClassName?: string;
  info?: React.ReactNode;
}) {
  return (
    // Raised so the tooltip paints above neighbouring cards in the stats grid.
    <div className={cn("panel px-3.5 py-2.5", Boolean(info) && "relative z-30")}>
      <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
        {label}
        {info && <InfoTip label={`About ${label}`}>{info}</InfoTip>}
      </div>
      <div
        className={cn(
          "num mt-0.5 text-[20px] font-bold leading-none",
          valueClassName ??
            cn(
              tone === "brand" && "text-brand-400",
              tone === "warn" && "text-amber-400",
              tone === "default" && "text-white",
            ),
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-[11.5px] text-slate-400">{sub}</div>}
    </div>
  );
}

export function PlayerLink({
  id,
  name,
  className,
}: {
  id: number;
  name: string;
  className?: string;
}) {
  return (
    <Link
      href={`/players/${id}`}
      className={cn("font-semibold text-white hover:text-brand-400 hover:underline", className)}
    >
      {name}
    </Link>
  );
}
