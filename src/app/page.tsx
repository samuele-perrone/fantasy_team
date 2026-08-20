import Link from "next/link";
import { getGameData, getPlayerRows } from "@/lib/fpl/data";
import { NAV } from "@/components/nav";
import { FixtureRun, PlayerLink, PositionBadge, StatCard } from "@/components/ui";
import { formatKickoff, money, relativeDeadline } from "@/lib/utils";

export const revalidate = 300;

export default async function HomePage() {
  const data = await getGameData();
  const rows = await getPlayerRows(5);
  const event = data.nextEvent ?? data.currentEvent;

  const available = rows.filter((r) => r.status === "a");
  const topPicks = [...available].sort((a, b) => b.xPtsNext - a.xPtsNext).slice(0, 8);
  const bestValue = [...available]
    .filter((r) => r.xMins > 45)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const differentials = [...available]
    .filter((r) => r.selectedBy < 8 && r.xMins > 55)
    .sort((a, b) => b.xPts - a.xPts)
    .slice(0, 8);

  const upcoming = data.fixtures
    .filter((f) => f.event === event?.id)
    .sort((a, b) => (a.kickoff_time ?? "").localeCompare(b.kickoff_time ?? ""));

  const risers = [...rows].sort((a, b) => b.netTransfers - a.netTransfers).slice(0, 5);
  const fallers = [...rows].sort((a, b) => a.netTransfers - b.netTransfers).slice(0, 5);

  const bestRuns = [...available]
    .filter((r) => r.fixtures.length >= 4)
    .filter((r, i, arr) => arr.findIndex((x) => x.teamId === r.teamId) === i)
    .sort((a, b) => a.fdr - b.fdr)
    .slice(0, 6);

  return (
    <div className="space-y-8">
      <section className="panel relative overflow-hidden px-6 py-8 sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-500/12 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-400">
            {event ? `Gameweek ${event.id}` : "Season"} · Fantasy Premier League
          </div>
          <h1 className="text-3xl font-black leading-[1.1] tracking-tight text-white sm:text-[42px]">
            Win your mini-league with data, not hunches.
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-slate-400">
            Points projections for all {data.bootstrap.elements.length} players, OPTA underlying
            stats, fixture difficulty analysis, live price change alerts and an AI squad optimiser —
            all built on live Fantasy Premier League data.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link
              href="/predictions"
              className="rounded-xl bg-brand-500 px-5 py-2.5 text-[14px] font-bold text-pitch-950 transition hover:bg-brand-400"
            >
              See points predictions
            </Link>
            <Link
              href="/my-team"
              className="rounded-xl border border-pitch-600 px-5 py-2.5 text-[14px] font-bold text-slate-200 transition hover:border-brand-500 hover:text-white"
            >
              Rate my team
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Next deadline"
          value={event ? relativeDeadline(event.deadline_time) : "—"}
          sub={event ? formatKickoff(event.deadline_time) : undefined}
          tone="brand"
        />
        <StatCard
          label="Managers playing"
          value={data.bootstrap.total_players.toLocaleString("en-GB")}
          sub="Registered FPL squads"
        />
        <StatCard
          label="Top projected pick"
          value={topPicks[0]?.name ?? "—"}
          sub={
            topPicks[0]
              ? `${topPicks[0].xPtsNext.toFixed(2)} xPts · ${money(topPicks[0].cost)}`
              : undefined
          }
        />
        <StatCard
          label="Most transferred in"
          value={risers[0]?.name ?? "—"}
          sub={
            risers[0] ? `${risers[0].netTransfers.toLocaleString("en-GB")} net this GW` : undefined
          }
          tone="warn"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card title="Captain shortlist" href="/predictions" cta="All predictions">
          <ol className="divide-y divide-pitch-800">
            {topPicks.slice(0, 5).map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="num w-4 text-[12px] font-bold text-slate-600">{i + 1}</span>
                <PositionBadge pos={p.pos} />
                <div className="min-w-0 flex-1">
                  <PlayerLink id={p.id} name={p.name} />
                  <div className="text-[11.5px] text-slate-500">
                    {p.team} · {money(p.cost)} · {p.selectedBy.toFixed(1)}% owned
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-[15px] font-bold text-brand-400">
                    {p.xPtsNext.toFixed(2)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-600">xPts</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Best value" href="/players" cta="Full stats">
          <ol className="divide-y divide-pitch-800">
            {bestValue.slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <PositionBadge pos={p.pos} />
                <div className="min-w-0 flex-1">
                  <PlayerLink id={p.id} name={p.name} />
                  <div className="text-[11.5px] text-slate-500">
                    {p.team} · {money(p.cost)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-[15px] font-bold text-white">{p.value.toFixed(2)}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-600">pts/£m</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Differentials under 8%" href="/players" cta="Explore">
          <ol className="divide-y divide-pitch-800">
            {differentials.slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <PositionBadge pos={p.pos} />
                <div className="min-w-0 flex-1">
                  <PlayerLink id={p.id} name={p.name} />
                  <div className="text-[11.5px] text-slate-500">
                    {p.team} · {money(p.cost)} · {p.selectedBy.toFixed(1)}% owned
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-[15px] font-bold text-accent-400">
                    {p.xPts.toFixed(1)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-600">5 GW</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title={`Gameweek ${event?.id ?? ""} fixtures`} href="/match-centre" cta="Match centre">
          <ul className="divide-y divide-pitch-800">
            {upcoming.slice(0, 10).map((f) => {
              const h = data.teams.get(f.team_h);
              const a = data.teams.get(f.team_a);
              return (
                <li key={f.id} className="flex items-center gap-3 py-2">
                  <span className="w-32 shrink-0 text-right text-[13px] font-semibold text-white">
                    {h?.name}
                  </span>
                  <span className="num rounded bg-pitch-800 px-2 py-0.5 text-[11px] font-bold text-slate-400">
                    {f.finished || f.started
                      ? `${f.team_h_score ?? 0} - ${f.team_a_score ?? 0}`
                      : "v"}
                  </span>
                  <span className="w-32 shrink-0 text-[13px] font-semibold text-white">
                    {a?.name}
                  </span>
                  <span className="ml-auto whitespace-nowrap text-[11.5px] text-slate-500">
                    {formatKickoff(f.kickoff_time)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Transfer market" href="/prices" cta="Price changes">
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-brand-400">
                Most bought
              </div>
              <ul className="space-y-1.5">
                {risers.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <PlayerLink id={p.id} name={p.name} className="truncate" />
                    <span className="num shrink-0 text-brand-400">
                      +{Math.round(p.netTransfers / 1000)}k
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-rose-400">
                Most sold
              </div>
              <ul className="space-y-1.5">
                {fallers.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <PlayerLink id={p.id} name={p.name} className="truncate" />
                    <span className="num shrink-0 text-rose-400">
                      {Math.round(p.netTransfers / 1000)}k
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-bold text-white">Best fixture runs, next 5</h2>
        <div className="panel divide-y divide-pitch-800">
          {bestRuns.map((r) => (
            <div key={r.teamId} className="flex flex-wrap items-center gap-4 px-4 py-2.5">
              <span className="w-32 text-[13.5px] font-bold text-white">{r.teamName}</span>
              <FixtureRun fixtures={r.fixtures} />
              <span className="num ml-auto text-[12.5px] text-slate-400">
                avg FDR {r.fdr.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-bold text-white">Every tool in the hub</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {NAV.flatMap((g) => g.items)
            .filter((item, i, arr) => arr.findIndex((x) => x.label === item.label) === i)
            .map((item) => (
              <Link
                key={item.label}
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
  cta,
  children,
}: {
  title: string;
  href: string;
  cta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel px-4 py-3.5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-bold text-white">{title}</h2>
        <Link
          href={href}
          className="shrink-0 text-[11.5px] font-semibold text-brand-400 hover:underline"
        >
          {cta} →
        </Link>
      </div>
      {children}
    </div>
  );
}
