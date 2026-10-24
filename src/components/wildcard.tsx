import Link from "next/link";
import type { WildcardView } from "@/lib/app/squad";
import type { PlayerRow } from "@/lib/fpl/row";
import { cn, money } from "@/lib/utils";
import { LinkPending } from "./link-pending";
import { ArmBand, ExpandableRow, PlayerLine, PlayerNumbers } from "./squad-ui";

const POSITION_ORDER = (a: PlayerRow, b: PlayerRow) => a.posId - b.posId;

function WildcardRow({
  p,
  view,
  kept,
  watched,
}: {
  p: PlayerRow;
  view: WildcardView;
  kept: Set<number>;
  watched: Set<number>;
}) {
  const armband = p.id === view.captainId ? "C" : p.id === view.viceId ? "V" : null;
  return (
    <ExpandableRow
      leading={
        <span
          className={cn(
            "inline-flex h-6 w-[52px] shrink-0 items-center justify-center rounded-md text-[10.5px] font-black uppercase tracking-wider ring-1 ring-inset",
            kept.has(p.id)
              ? "bg-pitch-800 text-slate-400 ring-pitch-600"
              : "bg-brand-400/15 text-brand-300 ring-brand-400/40",
          )}
        >
          {kept.has(p.id) ? "Keep" : "New"}
        </span>
      }
      photo={p}
      title={
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <PlayerLine p={p} />
          </div>
          {watched.has(p.id) && (
            <span className="text-[14px] leading-none text-amber-300" title="From your watchlist">
              ★<span className="sr-only">From your watchlist</span>
            </span>
          )}
          {armband && <ArmBand letter={armband} muted={armband === "V"} />}
        </div>
      }
      reason={
        <>
          {p.xPtsNext.toFixed(1)} points next week
          <span className="text-slate-500"> · {p.xPts.toFixed(1)} over five</span>
        </>
      }
    >
      <PlayerNumbers p={p} />
    </ExpandableRow>
  );
}

/** My Squad's wildcard view: the best squad the manager's money buys, against keeping theirs. */
export function Wildcard({
  view,
  back,
  watchToggle,
}: {
  view: WildcardView;
  back: string;
  /** signed in: whether the squad is built around the watchlist, and the link that flips it */
  watchToggle: { on: boolean; href: string } | null;
}) {
  const kept = new Set(view.keptIds);
  const watched = new Set(view.watchIds);
  const newCount = view.starters.length + view.bench.length - kept.size;
  const gain = Math.round(view.gain);

  return (
    <div>
      <Link
        href={back}
        className="mb-3 inline-block text-[13px] font-semibold text-slate-400 hover:text-white hover:underline"
      >
        ← My Squad
      </Link>
      <div className="mb-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-400">
          Wildcard · Gameweek {view.nextEvent}
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-white md:text-[28px]">
          Best squad for {money(view.budget)}
        </h1>
        <p className="mt-0.5 text-[12.5px] text-slate-400">
          {newCount} new, {kept.size} kept · costs {money(view.cost)} · {view.formation}
        </p>
      </div>

      {watchToggle && (
        <div className="panel mb-3 px-4 py-3 text-[13px]">
          <Link href={watchToggle.href} className="flex items-center gap-3" role="switch" aria-checked={watchToggle.on}>
            <span
              aria-hidden
              className={cn(
                "relative h-5 w-9 shrink-0 rounded-full transition",
                watchToggle.on ? "bg-brand-400" : "bg-pitch-700",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-[#ffffff] transition",
                  watchToggle.on ? "left-[18px]" : "left-0.5",
                )}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-white">Build around my watchlist</span>{" "}
              <span className="text-slate-400">
                Keeps your starred players where the budget and squad rules allow.
              </span>
            </span>
            <LinkPending>
              <span />
            </LinkPending>
          </Link>
          {watchToggle.on && view.watchSkipped.length > 0 && (
            <p className="mt-2 text-[12px] text-slate-500">
              Could not fit {view.watchSkipped.map((w) => w.name).join(", ")}: unavailable, or no
              squad within budget and the squad rules could hold them.
            </p>
          )}
          {watchToggle.on && view.watchIds.length === 0 && view.watchSkipped.length === 0 && (
            <p className="mt-2 text-[12px] text-slate-500">
              Your watchlist is empty. Star players on Players or My Squad to build around them.
            </p>
          )}
        </div>
      )}

      <div
        className={cn(
          "panel mb-4 px-4 py-3 text-[13.5px] leading-snug",
          view.saveIt ? "text-amber-300" : "text-brand-300",
        )}
      >
        {view.saveIt ? (
          <>
            <strong className="font-bold">Save your wildcard.</strong>{" "}
            {gain > 0
              ? `This squad would score about ${gain} more points over the next five gameweeks than yours, which is within what our estimates can get wrong.`
              : "Your squad is already about the best your money buys."}
          </>
        ) : (
          <>
            <strong className="font-bold">About {gain} more points</strong> over the next five
            gameweeks than your current squad.
          </>
        )}
      </div>

      <h2 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
        Starting XI for gameweek {view.nextEvent}
      </h2>
      <div className="grid items-start gap-2 lg:grid-cols-2 lg:gap-3">
        {[...view.starters].sort(POSITION_ORDER).map((p) => (
          <WildcardRow key={p.id} p={p} view={view} kept={kept} watched={watched} />
        ))}
      </div>

      <h2 className="mb-2 mt-5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
        Bench
      </h2>
      <div className="grid items-start gap-2 lg:grid-cols-2 lg:gap-3">
        {view.bench.map((p) => (
          <WildcardRow key={p.id} p={p} view={view} kept={kept} watched={watched} />
        ))}
      </div>

      <p className="mt-5 max-w-3xl text-[11.5px] leading-relaxed text-slate-500">
        The squad is picked for the most points over the next five gameweeks, within FPL&apos;s
        rules: two keepers, five defenders, five midfielders, three forwards, at most three from
        one club. The budget is your bank plus what we estimate your players sell for. FPL keeps
        half of any price rise and does not publish what you paid, so we assume the least you
        would get, and the squad is always affordable. Our points estimates are typically off by
        about 1.6 points per player per week.
      </p>
    </div>
  );
}
