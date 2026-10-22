import Link from "next/link";
import { setWatched } from "@/lib/app/actions";
import type { PlayerRow } from "@/lib/fpl/row";
import type { PlayerVerdict, Verdict } from "@/lib/fpl/verdict";
import { cn, money, timeAgo } from "@/lib/utils";
import { FixtureRun, OtherGames, PlayerFlag, PlayerPhoto } from "./ui";

const VERDICT_STYLE: Record<Verdict, string> = {
  sell: "bg-rose-500/15 text-rose-300 ring-rose-500/40",
  watch: "bg-amber-400/15 text-amber-300 ring-amber-400/40",
  keep: "bg-brand-400/15 text-brand-300 ring-brand-400/40",
};

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-[52px] shrink-0 items-center justify-center rounded-md text-[10.5px] font-black uppercase tracking-wider ring-1 ring-inset",
        VERDICT_STYLE[verdict],
      )}
    >
      {verdict}
    </span>
  );
}

/** Star toggle. A plain form posting to a server action, so it works without client JS. */
export function WatchButton({ playerId, watched }: { playerId: number; watched: boolean }) {
  return (
    <form action={setWatched}>
      <input type="hidden" name="playerId" value={playerId} />
      <input type="hidden" name="watch" value={watched ? "0" : "1"} />
      <button
        type="submit"
        aria-label={watched ? "Stop watching" : "Watch this player"}
        title={watched ? "Stop watching" : "Watch this player"}
        className={cn(
          "grid h-9 w-9 place-items-center rounded-lg text-[18px] leading-none transition",
          watched ? "text-amber-300 hover:text-amber-200" : "text-slate-500 hover:text-amber-300",
        )}
      >
        {watched ? "★" : "☆"}
      </button>
    </form>
  );
}

function PlayerLine({ p }: { p: PlayerRow }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {/* The name keeps its width and the club, position and price give way first. */}
      <span className="max-w-full shrink-0 truncate text-[14px] font-bold text-white">{p.name}</span>
      <PlayerFlag status={p.status} news={p.news} availability={p.availability} />
      <span className="min-w-0 truncate text-[11.5px] text-slate-500">
        {p.team} · {p.pos} · {money(p.cost)}
      </span>
    </div>
  );
}

function InfoIcon() {
  return (
    <span
      aria-hidden
      className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border border-pitch-600 text-[11px] font-bold text-slate-400 transition group-open:border-brand-500 group-open:bg-brand-500/15 group-open:text-brand-300"
    >
      i
    </span>
  );
}

/**
 * The numbers behind a verdict. Hidden behind the (i) on every row: the sentence is what a
 * manager reads first, the numbers are for checking it.
 */
export function PlayerNumbers({ p }: { p: PlayerRow }) {
  const stats: [string, string][] = [
    ["Points next game", p.xPtsNext.toFixed(1)],
    ["Points next 5", p.xPts.toFixed(1)],
    ["Minutes", String(p.xMins)],
    ["Chance of starting", `${Math.round(p.startProb * 100)}%`],
    ["Form", p.form.toFixed(1)],
    ["Price", money(p.cost)],
  ];
  const updated = timeAgo(p.newsAdded);
  const busy = p.fixtures.find((f) => f.congested);

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-3 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-pitch-900/70 px-2.5 py-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {label}
            </dt>
            <dd className="num mt-0.5 text-[15px] font-bold text-white">{value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Next games
        </div>
        <FixtureRun fixtures={p.fixtures} />
        {busy && (
          <p className="mt-1.5 text-[12px] leading-snug text-amber-200">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />
            Three games in seven days around gameweek {busy.event}, counting the cups and Europe.
          </p>
        )}
      </div>
      {p.otherGames.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Also playing
          </div>
          <OtherGames games={p.otherGames} />
        </div>
      )}
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          News
        </div>
        {p.news ? (
          <p className="text-[12.5px] leading-snug text-slate-300">
            {p.news}
            {updated && <span className="text-slate-500"> · updated {updated}</span>}
          </p>
        ) : (
          <p className="text-[12.5px] text-slate-500">No injury or team news.</p>
        )}
      </div>
      <Link
        href={`/players/${p.id}`}
        className="inline-block text-[12.5px] font-semibold text-brand-400 hover:underline"
      >
        Full profile →
      </Link>
    </div>
  );
}

/** A row that opens to show the numbers behind it. Uses <details> so it needs no client JS. */
export function ExpandableRow({
  leading,
  photo,
  title,
  reason,
  trailing,
  children,
}: {
  leading?: React.ReactNode;
  /** the player the row is about, shown as a headshot after `leading` */
  photo?: PlayerRow;
  title: React.ReactNode;
  reason: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details className="group panel overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        {leading}
        {photo && <PlayerPhoto code={photo.code} />}
        <div className="min-w-0 flex-1">
          {title}
          <p className="mt-0.5 text-[12.5px] leading-snug text-slate-300">{reason}</p>
        </div>
        <InfoIcon />
      </summary>
      <div className="border-t border-pitch-800 px-3 pb-3 pt-3">
        {children}
        {trailing}
      </div>
    </details>
  );
}

export function VerdictRow({ v, watched }: { v: PlayerVerdict; watched: Set<number> }) {
  const showReplacements = v.verdict !== "keep" && v.replacements.length > 0;
  return (
    <ExpandableRow
      leading={<VerdictPill verdict={v.verdict} />}
      photo={v.player}
      title={<PlayerLine p={v.player} />}
      reason={v.reason}
    >
      <PlayerNumbers p={v.player} />
      {v.needsHit && (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] leading-snug text-amber-200">
          You have no free transfer left for this, so it costs 4 points. It is only marked Sell
          because the gain is expected to clear that by at least another 4.
        </p>
      )}
      {showReplacements && (
        <div className="mt-4">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Replace with
          </div>
          <ul className="divide-y divide-pitch-800 rounded-lg bg-pitch-900/60">
            {v.replacements.map((r) => (
              <li key={r.player.id} className="flex items-center gap-2.5 py-1.5 pl-3 pr-1">
                <PlayerPhoto code={r.player.code} size={32} />
                <div className="min-w-0 flex-1">
                  <Link href={`/players/${r.player.id}`} className="hover:underline">
                    <PlayerLine p={r.player} />
                  </Link>
                  <p className="text-[12px] text-slate-400">
                    {r.reason} · about {Math.round(r.gain)} more points over five gameweeks
                  </p>
                </div>
                <WatchButton playerId={r.player.id} watched={watched.has(r.player.id)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </ExpandableRow>
  );
}

export { PlayerLine };
