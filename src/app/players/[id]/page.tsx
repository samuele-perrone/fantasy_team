import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getElementSummary } from "@/lib/fpl/client";
import { getGameData, POSITIONS, toRow } from "@/lib/fpl/data";
import { projectPlayer } from "@/lib/fpl/projection";
import { DifficultyPill, PageHeader, PositionBadge } from "@/components/ui";
import { badgeUrl, cn, formatKickoff, money, photoUrl } from "@/lib/utils";

export const revalidate = 600;

export async function generateMetadata({ params }: PageProps<"/players/[id]">): Promise<Metadata> {
  const { id } = await params;
  const data = await getGameData();
  const p = data.bootstrap.elements.find((e) => e.id === Number(id));
  if (!p) return { title: "Player not found" };
  const team = data.teams.get(p.team);
  return {
    title: `${p.first_name} ${p.second_name} — ${team?.name} stats & projections`,
    description: `FPL profile for ${p.web_name}: points projections, xG and xA, minutes, ownership, price history and upcoming fixture difficulty.`,
  };
}

export default async function PlayerProfile({ params }: PageProps<"/players/[id]">) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isFinite(playerId)) notFound();

  const data = await getGameData();
  const player = data.bootstrap.elements.find((e) => e.id === playerId);
  if (!player) notFound();

  const projection = projectPlayer(player, data.ctx, 8);
  const row = toRow(player, projection, data.teams);
  const team = data.teams.get(player.team);

  let summary: Awaited<ReturnType<typeof getElementSummary>> | null = null;
  try {
    summary = await getElementSummary(playerId);
  } catch {
    summary = null;
  }

  const history = summary?.history ?? [];
  const maxGwPoints = Math.max(6, ...history.map((h) => h.total_points));
  const positionPeers = data.bootstrap.elements
    .filter((e) => e.element_type === player.element_type && e.status === "a" && e.id !== player.id)
    .map((e) => ({ e, p: projectPlayer(e, data.ctx, 8) }))
    .sort((a, b) => b.p.horizon - a.p.horizon);
  const rankAmongPeers =
    positionPeers.filter((x) => x.p.horizon > projection.horizon).length + 1;

  const alternatives = positionPeers
    .filter((x) => Math.abs(x.e.now_cost - player.now_cost) <= 10)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-5 border-b border-pitch-800 bg-gradient-to-r from-pitch-800/60 to-transparent px-5 py-5">
          <Image
            src={photoUrl(player.code)}
            alt=""
            width={72}
            height={92}
            unoptimized
            className="h-[92px] w-[72px] rounded-lg bg-pitch-800 object-cover"
          />
          <div>
            <div className="flex items-center gap-2">
              <PositionBadge pos={POSITIONS[player.element_type]} />
              <Image
                src={badgeUrl(player.team_code)}
                alt=""
                width={18}
                height={18}
                unoptimized
                className="h-[18px] w-[18px]"
              />
              <span className="text-[12.5px] font-semibold text-slate-400">{team?.name}</span>
            </div>
            <h1 className="mt-1 text-[26px] font-black leading-tight tracking-tight text-white">
              {player.first_name} {player.second_name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-slate-400">
              <span className="num font-bold text-white">{money(row.cost)}</span>
              <span>{row.selectedBy.toFixed(1)}% owned</span>
              <span>
                {row.costChangeStart >= 0 ? "+" : ""}
                {row.costChangeStart.toFixed(1)} this season
              </span>
              {player.penalties_order === 1 && (
                <span className="rounded bg-accent-500/20 px-1.5 py-0.5 text-[11px] font-bold text-accent-400">
                  1st penalties
                </span>
              )}
            </div>
          </div>

        </div>

        {player.news && (
          <div className="border-b border-pitch-800 bg-amber-500/10 px-5 py-2.5 text-[12.5px] text-amber-300">
            <strong className="font-bold">Team news:</strong> {player.news}
            {player.chance_of_playing_next_round !== null &&
              ` · ${player.chance_of_playing_next_round}% chance of playing`}
          </div>
        )}

        <div className="grid grid-cols-2 divide-x divide-pitch-800 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Points next week" value={row.xPtsNext.toFixed(2)} tone="brand" />
          <Metric label="Next 8 weeks" value={row.xPts.toFixed(1)} />
          <Metric label="Minutes" value={String(row.xMins)} />
          <Metric label="Chance of starting" value={`${Math.round(row.startProb * 100)}%`} />
          <Metric label="Rating" value={row.rating.toFixed(1)} tone="brand" />
          <Metric
            label={`${POSITIONS[player.element_type]} rank`}
            value={`#${rankAmongPeers}`}
            sub="by points over 8 weeks"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="panel px-5 py-4">
          <h2 className="mb-3 text-[14px] font-bold text-white">Projected fixtures</h2>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-pitch-800 text-[10.5px] uppercase tracking-wide text-slate-500">
                <th className="py-1.5 text-left">GW</th>
                <th className="text-left">Opponent</th>
                <th className="text-right">Difficulty</th>
                <th className="text-right">Clean sheet</th>
                <th className="text-right">Goal or assist</th>
                <th className="text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {projection.fixtures.map((f, i) => (
                <tr key={`${f.fixtureId}-${i}`} className="border-b border-pitch-800/50">
                  <td className="num py-1.5 text-slate-400">{f.event}</td>
                  <td className="py-1.5">
                    <span className="font-semibold text-white">
                      {data.teams.get(f.opponent)?.short_name}
                    </span>
                    <span className="ml-1 text-[11px] text-slate-500">
                      {f.isHome ? "(H)" : "(A)"}
                    </span>
                  </td>
                  <td className="py-1.5 text-right">
                    <DifficultyPill difficulty={f.difficulty} className="min-w-[24px]">
                      {f.difficulty}
                    </DifficultyPill>
                  </td>
                  <td className="num py-1.5 text-right text-slate-400">
                    {Math.round(f.cleanSheetProb * 100)}%
                  </td>
                  <td className="num py-1.5 text-right text-slate-400">
                    {Math.round(f.returnProb * 100)}%
                  </td>
                  <td className="num py-1.5 text-right font-bold text-brand-400">
                    {f.points.toFixed(2)}
                  </td>
                </tr>
              ))}
              {!projection.fixtures.length && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No upcoming fixtures scheduled.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="panel px-5 py-4">
          <h2 className="mb-3 text-[14px] font-bold text-white">Season underlying numbers</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
            <Stat label="Points" value={row.totalPoints} />
            <Stat label="Points per game" value={row.ppg.toFixed(1)} />
            <Stat label="Minutes" value={row.minutes.toLocaleString("en-GB")} />
            <Stat label="Starts" value={row.starts} />
            <Stat label="Goals" value={row.goals} />
            <Stat label="Assists" value={row.assists} />
            <Stat label="xG" value={row.xG.toFixed(2)} />
            <Stat label="xA" value={row.xA.toFixed(2)} />
            <Stat label="xG per 90" value={row.xG90.toFixed(2)} />
            <Stat label="xA per 90" value={row.xA90.toFixed(2)} />
            <Stat label="Clean sheets" value={row.cleanSheets} />
            <Stat label="xGC per 90" value={row.xGC90.toFixed(2)} />
            <Stat label="Defensive actions" value={row.dc} />
            <Stat label="DC per 90" value={row.dc90.toFixed(1)} />
            <Stat label="Bonus" value={row.bonus} />
            <Stat label="BPS" value={row.bps} />
            <Stat label="ICT index" value={row.ict.toFixed(1)} />
            <Stat label="Cards" value={`${row.yellowCards}Y / ${row.redCards}R`} />
          </dl>
        </section>
      </div>

      {history.length > 0 && (
        <section className="panel px-5 py-4">
          <h2 className="mb-4 text-[14px] font-bold text-white">Gameweek history</h2>
          <div className="flex items-end gap-1 overflow-x-auto pb-2">
            {history.map((h) => (
              <div key={h.round} className="flex w-8 shrink-0 flex-col items-center gap-1">
                <span className="num text-[10px] text-slate-500">{h.total_points}</span>
                <div
                  title={`GW${h.round}: ${h.total_points} pts, ${h.minutes} mins`}
                  className={cn(
                    "w-full rounded-t",
                    h.total_points >= 10
                      ? "bg-brand-400"
                      : h.total_points >= 5
                        ? "bg-brand-500/70"
                        : h.total_points > 0
                          ? "bg-pitch-500"
                          : "bg-pitch-700",
                  )}
                  style={{ height: `${Math.max(3, (h.total_points / maxGwPoints) * 110)}px` }}
                />
                <span className="text-[9.5px] text-slate-600">{h.round}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-[12.5px]">
              <thead>
                <tr className="border-b border-pitch-800 text-[10.5px] uppercase tracking-wide text-slate-500">
                  <th className="py-1.5 text-left">GW</th>
                  <th className="text-left">Opp</th>
                  <th className="text-right">Pts</th>
                  <th className="text-right">Mins</th>
                  <th className="text-right">G</th>
                  <th className="text-right">A</th>
                  <th className="text-right">xG</th>
                  <th className="text-right">xA</th>
                  <th className="text-right">CS</th>
                  <th className="text-right">Bonus</th>
                  <th className="text-right">BPS</th>
                  <th className="text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h, i) => (
                  <tr key={`${h.round}-${i}`} className="border-b border-pitch-800/50">
                    <td className="num py-1.5 text-slate-400">{h.round}</td>
                    <td className="py-1.5 font-medium text-slate-300">
                      {data.teams.get(h.opponent_team)?.short_name} {h.was_home ? "(H)" : "(A)"}
                    </td>
                    <td className="num py-1.5 text-right font-bold text-white">{h.total_points}</td>
                    <td className="num py-1.5 text-right text-slate-400">{h.minutes}</td>
                    <td className="num py-1.5 text-right text-slate-400">{h.goals_scored}</td>
                    <td className="num py-1.5 text-right text-slate-400">{h.assists}</td>
                    <td className="num py-1.5 text-right text-slate-400">{h.expected_goals}</td>
                    <td className="num py-1.5 text-right text-slate-400">{h.expected_assists}</td>
                    <td className="num py-1.5 text-right text-slate-400">{h.clean_sheets}</td>
                    <td className="num py-1.5 text-right text-slate-400">{h.bonus}</td>
                    <td className="num py-1.5 text-right text-slate-400">{h.bps}</td>
                    <td className="num py-1.5 text-right text-slate-400">
                      {(h.value / 10).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {summary?.history_past?.length ? (
        <section className="panel px-5 py-4">
          <h2 className="mb-3 text-[14px] font-bold text-white">Previous seasons</h2>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-pitch-800 text-[10.5px] uppercase tracking-wide text-slate-500">
                <th className="py-1.5 text-left">Season</th>
                <th className="text-right">Pts</th>
                <th className="text-right">Mins</th>
                <th className="text-right">G</th>
                <th className="text-right">A</th>
                <th className="text-right">CS</th>
                <th className="text-right">Bonus</th>
                <th className="text-right">Start £</th>
                <th className="text-right">End £</th>
              </tr>
            </thead>
            <tbody>
              {[...summary.history_past].reverse().map((s) => (
                <tr key={s.season_name} className="border-b border-pitch-800/50">
                  <td className="py-1.5 font-semibold text-slate-300">{s.season_name}</td>
                  <td className="num py-1.5 text-right font-bold text-white">{s.total_points}</td>
                  <td className="num py-1.5 text-right text-slate-400">{s.minutes}</td>
                  <td className="num py-1.5 text-right text-slate-400">{s.goals_scored}</td>
                  <td className="num py-1.5 text-right text-slate-400">{s.assists}</td>
                  <td className="num py-1.5 text-right text-slate-400">{s.clean_sheets}</td>
                  <td className="num py-1.5 text-right text-slate-400">{s.bonus}</td>
                  <td className="num py-1.5 text-right text-slate-400">
                    {(s.start_cost / 10).toFixed(1)}
                  </td>
                  <td className="num py-1.5 text-right text-slate-400">
                    {(s.end_cost / 10).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section>
        <PageHeader
          title="Similar-priced alternatives"
          description={`Other ${POSITIONS[player.element_type]}s within £1.0m, ranked by projected points over the next 8 gameweeks.`}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {alternatives.map(({ e, p }) => (
            <Link
              key={e.id}
              href={`/players/${e.id}`}
              className="panel flex items-center gap-3 px-4 py-3 transition hover:border-brand-500/60"
            >
              <Image
                src={photoUrl(e.code)}
                alt=""
                width={34}
                height={44}
                unoptimized
                className="h-[44px] w-[34px] rounded bg-pitch-800 object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold text-white">{e.web_name}</div>
                <div className="text-[11.5px] text-slate-500">
                  {data.teams.get(e.team)?.short_name} · {money(e.now_cost / 10)}
                </div>
              </div>
              <div className="text-right">
                <div className="num text-[15px] font-bold text-brand-400">
                  {p.horizon.toFixed(1)}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-slate-600">8 GW</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-[11.5px] text-slate-600">
        Next fixture: {formatKickoff(summary?.fixtures?.[0]?.kickoff_time ?? null)}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "brand";
}) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div
        className={cn(
          "num mt-0.5 text-[20px] font-bold leading-none",
          tone === "brand" ? "text-brand-400" : "text-white",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10.5px] text-slate-600">{sub}</div>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-pitch-800/60 pb-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className="num font-semibold text-white">{value}</dd>
    </div>
  );
}
