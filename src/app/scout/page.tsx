import type { Metadata } from "next";
import Image from "next/image";
import { getGameData, getPlayerRows } from "@/lib/fpl/data";
import { FixtureRun, PageHeader, PlayerLink, PositionBadge, StatCard } from "@/components/ui";
import { badgeUrl, cn, money } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Team News & Scout Picks",
  description:
    "Injuries, doubts and suspensions across all 20 clubs, model-predicted lineups from minutes probability, and this week's captain and differential shortlists.",
};

const STATUS_LABEL: Record<string, string> = {
  d: "Doubtful",
  i: "Injured",
  s: "Suspended",
  n: "Ineligible",
  u: "Unavailable",
};

export default async function ScoutPage() {
  const [data, rows] = await Promise.all([getGameData(), getPlayerRows(5)]);

  const flagged = rows
    .filter((r) => r.status !== "a")
    .sort((a, b) => b.selectedBy - a.selectedBy);

  const injured = flagged.filter((r) => r.status === "i");
  const doubtful = flagged.filter((r) => r.status === "d");
  const suspended = flagged.filter((r) => r.status === "s");

  const available = rows.filter((r) => r.status === "a");
  const captains = [...available].sort((a, b) => b.xPtsNext - a.xPtsNext).slice(0, 6);
  const differentials = [...available]
    .filter((r) => r.selectedBy < 6 && r.xMins > 60)
    .sort((a, b) => b.xPts - a.xPts)
    .slice(0, 8);
  const budget = [...available]
    .filter((r) => r.cost <= 5.5 && r.xMins > 60)
    .sort((a, b) => b.xPts - a.xPts)
    .slice(0, 8);

  // Predicted lineup = the 11 most likely starters per club, shaped into a legal formation.
  const lineups = data.bootstrap.teams.map((team) => {
    const squad = rows.filter((r) => r.teamId === team.id && r.status !== "u");
    const pick = (pos: number, count: number) =>
      squad
        .filter((r) => r.posId === pos)
        .sort((a, b) => b.startProb - a.startProb || b.xMins - a.xMins)
        .slice(0, count);
    return {
      team,
      lines: [pick(1, 1), pick(2, 4), pick(3, 4), pick(4, 2)],
      fixtures: squad[0]?.fixtures.slice(0, 3) ?? [],
    };
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Planners"
        title="Team News & Scout Picks"
        description="Every flagged player in the game with their official status, linked to the club's own press conference where FPL cites one, plus predicted lineups derived from start probability."
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Injured" value={injured.length} sub="Ruled out" tone="warn" />
        <StatCard label="Doubtful" value={doubtful.length} sub="75% or less chance" tone="warn" />
        <StatCard label="Suspended" value={suspended.length} sub="Serving a ban" />
        <StatCard
          label="Most-owned casualty"
          value={flagged[0]?.name ?? "None"}
          sub={flagged[0] ? `${flagged[0].selectedBy.toFixed(1)}% owned` : "No flags in the game"}
        />
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-bold text-white">Injuries, doubts and bans</h2>
        {!flagged.length ? (
          <div className="panel px-6 py-10 text-center text-[13.5px] text-slate-400">
            No flagged players in the game right now.
          </div>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="border-b border-pitch-700 text-[10.5px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 text-left">Player</th>
                  <th className="text-left">Status</th>
                  <th className="text-right">Chance</th>
                  <th className="text-right">Owned</th>
                  <th className="px-4 text-left">News</th>
                </tr>
              </thead>
              <tbody>
                {flagged.map((r) => (
                  <tr key={r.id} className="border-b border-pitch-800/60 hover:bg-pitch-800/40">
                    <td className="px-4 py-1.5">
                      <div className="flex items-center gap-2">
                        <PositionBadge pos={r.pos} />
                        <PlayerLink id={r.id} name={r.name} />
                        <span className="text-[11px] text-slate-500">{r.team}</span>
                      </div>
                    </td>
                    <td className="py-1.5">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide",
                          r.status === "d"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-rose-500/20 text-rose-300",
                        )}
                      >
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="num pr-1 text-right text-slate-400">
                      {r.availability !== null ? `${r.availability}%` : "0%"}
                    </td>
                    <td className="num pr-1 text-right text-slate-400">
                      {r.selectedBy.toFixed(1)}%
                    </td>
                    <td className="px-4 py-1.5 text-[12px] text-slate-400">
                      {r.news || "—"}
                      {r.newsSource && (
                        <a
                          href={r.newsSource}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 whitespace-nowrap font-semibold text-brand-400 hover:underline"
                        >
                          press conference →
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ScoutList title="Captain shortlist" subtitle="Highest projected next gameweek" rows={captains} metric="xPtsNext" suffix="xPts" />
        <ScoutList title="Differentials" subtitle="Under 6% owned, next 5 GWs" rows={differentials} metric="xPts" suffix="5 GW" />
        <ScoutList title="Budget enablers" subtitle="£5.5m or less with minutes" rows={budget} metric="xPts" suffix="5 GW" />
      </section>

      <section>
        <h2 className="mb-1 text-[15px] font-bold text-white">Predicted lineups</h2>
        <p className="mb-3 text-[13px] text-slate-400">
          The eleven players at each club with the highest modelled start probability, shaped into
          a 4-4-2. Treat it as a data prior, not a manager&apos;s team sheet.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {lineups.map(({ team, lines, fixtures }) => (
            <div key={team.id} className="panel px-5 py-4">
              <div className="mb-2.5 flex items-center gap-2.5">
                <Image
                  src={badgeUrl(team.code)}
                  alt=""
                  width={22}
                  height={22}
                  unoptimized
                  className="h-[22px] w-[22px]"
                />
                <h3 className="text-[14px] font-bold text-white">{team.name}</h3>
                <span className="ml-auto">
                  <FixtureRun fixtures={fixtures} max={3} />
                </span>
              </div>
              <div className="space-y-1.5">
                {lines.map((line, i) => (
                  <div key={i} className="flex flex-wrap gap-1.5">
                    {line.map((p) => (
                      <span
                        key={p.id}
                        title={`${Math.round(p.startProb * 100)}% start probability`}
                        className="flex items-center gap-1.5 rounded bg-pitch-900/70 px-2 py-1 text-[12px]"
                      >
                        <PositionBadge pos={p.pos} />
                        <PlayerLink id={p.id} name={p.name} />
                        <span className="num text-[10px] text-slate-600">
                          {Math.round(p.startProb * 100)}%
                        </span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ScoutList({
  title,
  subtitle,
  rows,
  metric,
  suffix,
}: {
  title: string;
  subtitle: string;
  rows: import("@/lib/fpl/row").PlayerRow[];
  metric: "xPts" | "xPtsNext";
  suffix: string;
}) {
  return (
    <div className="panel px-4 py-3.5">
      <h2 className="text-[14px] font-bold text-white">{title}</h2>
      <p className="mb-2 text-[11.5px] text-slate-500">{subtitle}</p>
      <ol className="divide-y divide-pitch-800">
        {rows.map((p) => (
          <li key={p.id} className="flex items-center gap-2.5 py-2">
            <PositionBadge pos={p.pos} />
            <div className="min-w-0 flex-1">
              <PlayerLink id={p.id} name={p.name} />
              <div className="text-[11px] text-slate-500">
                {p.team} · {money(p.cost)} · {p.selectedBy.toFixed(1)}%
              </div>
            </div>
            <div className="text-right">
              <div className="num text-[14.5px] font-bold text-brand-400">
                {p[metric].toFixed(metric === "xPtsNext" ? 2 : 1)}
              </div>
              <div className="text-[9.5px] uppercase tracking-wide text-slate-600">{suffix}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
