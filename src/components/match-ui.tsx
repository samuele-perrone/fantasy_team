import Image from "next/image";
import Link from "next/link";
import type { Incident, Match, MatchPlayer, MatchSide } from "@/lib/fpl/matches";
import { badgeUrl, cn } from "@/lib/utils";
import { PlayerPhoto } from "./ui";

const kickoffTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });

function Badge({ side }: { side: MatchSide }) {
  return (
    <Image
      src={badgeUrl(side.code)}
      alt=""
      width={22}
      height={22}
      unoptimized
      className="h-[22px] w-[22px] shrink-0"
    />
  );
}

function Status({ m }: { m: Match }) {
  if (m.status === "live") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-bold text-rose-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
        {m.minutes}&apos;
      </span>
    );
  }
  if (m.status === "finished") {
    return <span className="text-[11px] font-semibold text-slate-500">FT</span>;
  }
  return null;
}

function Centre({ m }: { m: Match }) {
  if (m.status === "postponed") {
    return <span className="text-[12px] font-semibold text-slate-500">TBC</span>;
  }
  if (m.status === "upcoming") {
    return <span className="num text-[14px] font-bold text-slate-200">{kickoffTime(m.kickoff!)}</span>;
  }
  return (
    <span
      className={cn(
        "num text-[18px] font-black tracking-tight",
        m.status === "live" ? "text-white" : "text-slate-200",
      )}
    >
      {m.home.score} – {m.away.score}
    </span>
  );
}

function playerTone(p: { mine: boolean; watched: boolean }) {
  return p.mine
    ? "bg-brand-400/15 text-brand-200 ring-brand-400/40"
    : "bg-amber-400/10 text-amber-200 ring-amber-400/30";
}

function PlayerChip({ p }: { p: MatchPlayer }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-[11.5px] font-semibold ring-1 ring-inset",
        playerTone(p),
      )}
    >
      <PlayerPhoto code={p.code} name={p.name} size={20} className="text-[8px]" />
      {!p.mine && <span aria-label="Watching">★</span>}
      {p.name}
      {p.points !== null && <span className="num font-black">{p.points}</span>}
    </span>
  );
}

/** "count" shows ×2 for a brace; "points" always shows the value, as bonus needs. */
type Show = "count" | "points";

function IncidentList({
  items,
  highlight,
  align,
  show,
}: {
  items: Incident[];
  highlight: Map<number, MatchPlayer>;
  align: "left" | "right";
  show: Show;
}) {
  return (
    <ul className={cn("min-w-0 flex-1 space-y-0.5", align === "right" && "text-right")}>
      {items.map((i) => {
        const p = highlight.get(i.playerId);
        return (
          <li key={i.playerId} className="text-[12.5px] leading-snug">
            <Link
              href={`/players/${i.playerId}`}
              className={cn(
                "hover:underline",
                p ? (p.mine ? "font-bold text-brand-300" : "font-bold text-amber-300") : "text-slate-200",
              )}
            >
              {i.name}
            </Link>
            {show === "points" ? (
              <span className="num font-bold text-slate-400"> {i.value}</span>
            ) : (
              i.value > 1 && <span className="text-slate-500"> ×{i.value}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ReportLine({
  label,
  items,
  highlight,
  show = "count",
}: {
  label: string;
  items: Incident[];
  highlight: Map<number, MatchPlayer>;
  show?: Show;
}) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="flex gap-4">
        <IncidentList
          items={items.filter((i) => i.side === "h")}
          highlight={highlight}
          align="right"
          show={show}
        />
        <IncidentList
          items={items.filter((i) => i.side === "a")}
          highlight={highlight}
          align="left"
          show={show}
        />
      </div>
    </div>
  );
}

function MatchReport({ m }: { m: Match }) {
  const highlight = new Map(m.players.map((p) => [p.id, p]));
  const started = m.status === "live" || m.status === "finished";

  return (
    <div className="space-y-3">
      {!started ? (
        <p className="text-center text-[12.5px] text-slate-400">
          {m.status === "postponed" ? "Date to be confirmed." : "Not started yet."}
        </p>
      ) : (
        <>
          <ReportLine label="Goals" items={m.goals} highlight={highlight} />
          <ReportLine label="Own goals" items={m.ownGoals} highlight={highlight} />
          <ReportLine label="Assists" items={m.assists} highlight={highlight} />
          <ReportLine label="Penalties saved" items={m.penaltiesSaved} highlight={highlight} />
          <ReportLine label="Penalties missed" items={m.penaltiesMissed} highlight={highlight} />
          <ReportLine label="Red cards" items={m.redCards} highlight={highlight} />
          <ReportLine label="Yellow cards" items={m.yellowCards} highlight={highlight} />
          <ReportLine
            label={m.bonusProvisional ? "Bonus, if it ended now" : "Bonus"}
            items={m.bonus}
            highlight={highlight}
            show="points"
          />
        </>
      )}

      {m.players.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Your players
          </div>
          <ul className="divide-y divide-pitch-800 rounded-lg bg-pitch-900/60">
            {m.players.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 px-3 py-1.5">
                <PlayerPhoto code={p.code} name={p.name} size={32} />
                <Link
                  href={`/players/${p.id}`}
                  className={cn(
                    "min-w-0 flex-1 truncate text-[13px] font-semibold hover:underline",
                    p.mine ? "text-brand-200" : "text-amber-200",
                  )}
                >
                  {!p.mine && "★ "}
                  {p.name}
                  <span className="font-normal text-slate-500">
                    {" "}
                    · {p.side === "h" ? m.home.short : m.away.short}
                  </span>
                </Link>
                {p.points !== null ? (
                  <span className="text-[12px] text-slate-400">
                    {p.minutes ? `${p.minutes}'` : "Not played"} ·{" "}
                    <span className="num font-bold text-white">{p.points}</span> pts
                  </span>
                ) : (
                  <span className="text-[12px] text-slate-500">
                    {p.mine ? "In your squad" : "Watching"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** One match. Opens in place to the scorers, cards and bonus, so it needs no client JS. */
export function MatchRow({ m }: { m: Match }) {
  return (
    <details className="group panel overflow-hidden" open={m.status === "live" ? true : undefined}>
      <summary className="cursor-pointer list-none px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex min-w-0 items-center justify-end gap-2">
            <span className="truncate text-[14px] font-bold text-white">{m.home.name}</span>
            <Badge side={m.home} />
          </div>
          <div className="flex min-w-[64px] flex-col items-center">
            <Centre m={m} />
            <Status m={m} />
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <Badge side={m.away} />
            <span className="truncate text-[14px] font-bold text-white">{m.away.name}</span>
          </div>
        </div>
        {m.players.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-1">
            {m.players.map((p) => (
              <PlayerChip key={p.id} p={p} />
            ))}
          </div>
        )}
      </summary>
      <div className="border-t border-pitch-800 px-3 pb-3 pt-3">
        <MatchReport m={m} />
      </div>
    </details>
  );
}
