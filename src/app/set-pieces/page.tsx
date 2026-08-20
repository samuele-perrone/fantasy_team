import type { Metadata } from "next";
import Image from "next/image";
import { getGameData } from "@/lib/fpl/data";
import { PageHeader, PlayerLink, PositionBadge } from "@/components/ui";
import { badgeUrl, cn, money } from "@/lib/utils";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Set Piece Takers",
  description:
    "Penalty, corner and direct free-kick takers for all 20 Premier League clubs, straight from the official Fantasy Premier League set piece notes.",
};

const DUTIES = [
  { key: "penalties_order" as const, text: "penalties_text" as const, label: "Penalties", tone: "text-accent-400" },
  { key: "direct_freekicks_order" as const, text: "direct_freekicks_text" as const, label: "Direct free-kicks", tone: "text-brand-400" },
  { key: "corners_and_indirect_freekicks_order" as const, text: "corners_and_indirect_freekicks_text" as const, label: "Corners & indirect", tone: "text-sky-400" },
];

export default async function SetPiecesPage() {
  const data = await getGameData();

  const teams = [...data.bootstrap.teams].sort((a, b) => a.name.localeCompare(b.name));

  const penaltyTakers = data.bootstrap.elements
    .filter((p) => p.penalties_order === 1)
    .sort((a, b) => b.total_points - a.total_points);

  return (
    <div>
      <PageHeader
        eyebrow="Planners"
        title="Set Piece Takers"
        description="Who takes what, club by club, from the set piece notes published inside the Fantasy Premier League game. A first-choice penalty taker is worth roughly a tenth of a goal per game on its own, which is why the projection model gives them an explicit boost."
      />

      <section className="panel mb-6 px-5 py-4">
        <h2 className="mb-3 text-[14px] font-bold text-white">
          First-choice penalty takers ({penaltyTakers.length})
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {penaltyTakers.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg bg-pitch-900/60 px-3 py-2">
              <Image
                src={badgeUrl(p.team_code)}
                alt=""
                width={18}
                height={18}
                unoptimized
                className="h-[18px] w-[18px]"
              />
              <PlayerLink id={p.id} name={p.web_name} className="text-[13px]" />
              <span className="num ml-auto text-[11.5px] text-slate-500">
                {money(p.now_cost / 10)}
              </span>
            </div>
          ))}
          {!penaltyTakers.length && (
            <p className="text-[13px] text-slate-500">
              FPL has not published set piece notes for the new season yet.
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {teams.map((team) => {
          const squad = data.bootstrap.elements.filter((p) => p.team === team.id);
          const duties = DUTIES.map((duty) => ({
            ...duty,
            players: squad
              .filter((p) => p[duty.key] !== null)
              .sort((a, b) => (a[duty.key] ?? 99) - (b[duty.key] ?? 99))
              .slice(0, 4),
            note: squad.find((p) => p[duty.text])?.[duty.text] ?? "",
          }));

          const hasAny = duties.some((d) => d.players.length);

          return (
            <section key={team.id} className="panel px-5 py-4">
              <div className="mb-3 flex items-center gap-2.5">
                <Image
                  src={badgeUrl(team.code)}
                  alt=""
                  width={22}
                  height={22}
                  unoptimized
                  className="h-[22px] w-[22px]"
                />
                <h2 className="text-[14px] font-bold text-white">{team.name}</h2>
              </div>

              {!hasAny ? (
                <p className="text-[12.5px] text-slate-500">No set piece notes published yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {duties.map((duty) => (
                    <div key={duty.label}>
                      <div
                        className={cn(
                          "mb-1 text-[10.5px] font-bold uppercase tracking-wider",
                          duty.tone,
                        )}
                      >
                        {duty.label}
                      </div>
                      {duty.players.length ? (
                        <ol className="flex flex-wrap gap-1.5">
                          {duty.players.map((p) => (
                            <li
                              key={p.id}
                              className="flex items-center gap-1.5 rounded bg-pitch-900/70 px-2 py-1 text-[12.5px]"
                            >
                              <span className="num text-[10px] font-bold text-slate-600">
                                {p[duty.key]}
                              </span>
                              <PositionBadge
                                pos={["", "GKP", "DEF", "MID", "FWD"][p.element_type]}
                              />
                              <PlayerLink id={p.id} name={p.web_name} />
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="text-[12px] text-slate-600">Not specified.</p>
                      )}
                      {duty.note && (
                        <p className="mt-1 text-[11.5px] italic leading-snug text-slate-500">
                          {duty.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
