import Link from "next/link";
import { getGameData, getPlayerRows } from "@/lib/fpl/data";
import { NAV } from "@/components/nav";
import { PlayerFlag, PlayerLink, PositionBadge } from "@/components/ui";
import { money, relativeDeadline } from "@/lib/utils";

export const revalidate = 300;

export default async function HomePage() {
  const data = await getGameData();
  const rows = await getPlayerRows(5);
  const event = data.nextEvent ?? data.currentEvent;

  const available = rows.filter((r) => r.status === "a");
  const bestCaptains = [...available].sort((a, b) => b.xPtsNext - a.xPtsNext).slice(0, 5);
  const inForm = [...available]
    .filter((r) => r.xMins > 45)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const flagged = rows.filter((r) => r.status !== "a" && r.selectedBy > 5).slice(0, 5);

  return (
    <div className="space-y-8">
      <section className="panel px-6 py-8 sm:px-10">
        <h1 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-[38px]">
          {event ? `${event.name} is next` : "Fantasy Premier League"}
        </h1>
        {event && (
          <p className="mt-2 text-[15px] text-slate-400">
            Deadline in{" "}
            <strong className="text-brand-400">{relativeDeadline(event.deadline_time)}</strong>
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link
            href="/my-team"
            className="rounded-xl bg-brand-500 px-5 py-2.5 text-[14px] font-bold text-pitch-950 transition hover:bg-brand-400"
          >
            Check my team
          </Link>
          <Link
            href="/transfers"
            className="rounded-xl border border-pitch-600 px-5 py-2.5 text-[14px] font-bold text-slate-200 transition hover:border-brand-500 hover:text-white"
          >
            See transfers
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card title="Best captain picks" href="/players">
          {bestCaptains.map((p) => (
            <Row key={p.id} player={p} value={p.xPtsNext.toFixed(1)} unit="pts" />
          ))}
        </Card>

        <Card title="Best value" href="/players">
          {inForm.map((p) => (
            <Row key={p.id} player={p} value={p.value.toFixed(1)} unit="per £m" />
          ))}
        </Card>

        <Card title="Injury doubts" href="/scout">
          {flagged.length ? (
            flagged.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 py-2 text-[12.5px]">
                <PositionBadge pos={p.pos} />
                <PlayerLink id={p.id} name={p.name} />
                <PlayerFlag status={p.status} news={p.news} availability={p.availability} />
                <span className="ml-auto text-right text-[11.5px] text-slate-400">
                  {p.availability !== null ? `${p.availability}%` : "Out"}
                </span>
              </li>
            ))
          ) : (
            <li className="py-3 text-[12.5px] text-slate-500">
              No widely-owned players are flagged.
            </li>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-bold text-white">Everything else</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="panel group px-4 py-3.5 transition hover:border-brand-500/60"
            >
              <div className="text-[13.5px] font-bold text-white group-hover:text-brand-400">
                {item.label}
              </div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-slate-500">{item.desc}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Card({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel px-4 py-3.5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-bold text-white">{title}</h2>
        <Link href={href} className="text-[11.5px] font-semibold text-brand-400 hover:underline">
          More →
        </Link>
      </div>
      <ol className="divide-y divide-pitch-800">{children}</ol>
    </div>
  );
}

function Row({
  player,
  value,
  unit,
}: {
  player: { id: number; name: string; pos: string; team: string; cost: number };
  value: string;
  unit: string;
}) {
  return (
    <li className="flex items-center gap-2.5 py-2">
      <PositionBadge pos={player.pos} />
      <div className="min-w-0 flex-1">
        <PlayerLink id={player.id} name={player.name} />
        <div className="text-[11px] text-slate-500">
          {player.team} · {money(player.cost)}
        </div>
      </div>
      <div className="text-right">
        <div className="num text-[14px] font-bold text-brand-400">{value}</div>
        <div className="text-[9.5px] uppercase tracking-wide text-slate-600">{unit}</div>
      </div>
    </li>
  );
}
