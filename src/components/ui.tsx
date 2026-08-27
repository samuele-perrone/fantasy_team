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

export function StatusDot({ status, news }: { status: string; news: string }) {
  if (status === "a") return null;
  const color =
    status === "d" ? "bg-amber-400" : status === "s" ? "bg-rose-500" : "bg-rose-500";
  return (
    <span
      title={news || "Unavailable"}
      className={cn("inline-block h-[7px] w-[7px] shrink-0 rounded-full", color)}
    />
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
