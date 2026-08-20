import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getLive } from "@/lib/fpl/client";
import { getGameData } from "@/lib/fpl/data";
import type { FplFixture, LiveElement } from "@/lib/fpl/types";
import { PageHeader, PlayerLink, PositionBadge } from "@/components/ui";
import { badgeUrl, cn, formatKickoff } from "@/lib/utils";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Match Centre",
  description:
    "Live Premier League scores, goalscorers, assists and provisional Fantasy Premier League bonus points, fixture by fixture.",
};

/** Provisional bonus: top three BPS in a match take 3, 2 and 1, with ties sharing the higher award. */
function provisionalBonus(bpsRanked: { element: number; bps: number }[]) {
  const bonus = new Map<number, number>();
  const distinct = [...new Set(bpsRanked.map((b) => b.bps))].sort((a, b) => b - a).slice(0, 3);
  let awarded = 0;
  const values = [3, 2, 1];

  for (const score of distinct) {
    if (awarded >= 3) break;
    const tied = bpsRanked.filter((b) => b.bps === score);
    const points = values[awarded] ?? 0;
    for (const t of tied) bonus.set(t.element, points);
    awarded += tied.length;
  }
  return bonus;
}

export default async function MatchCentre({ searchParams }: PageProps<"/match-centre">) {
  const params = await searchParams;
  const data = await getGameData();
  const defaultEvent = data.currentEvent?.id ?? data.ctx.nextEvent;
  const raw = Number(Array.isArray(params.event) ? params.event[0] : params.event);
  const event = Number.isFinite(raw) && raw > 0 ? raw : defaultEvent;

  let live: LiveElement[] = [];
  try {
    live = (await getLive(event)).elements;
  } catch {
    live = [];
  }
  const liveById = new Map(live.map((e) => [e.id, e]));

  const fixtures = data.fixtures
    .filter((f) => f.event === event)
    .sort((a, b) => (a.kickoff_time ?? "").localeCompare(b.kickoff_time ?? ""));

  const eventIds = data.events.map((e) => e.id);

  return (
    <div>
      <PageHeader
        eyebrow="Toolbox"
        title="Match Centre"
        description="Every fixture in the gameweek with live scores, goalscorers and assists, and the provisional bonus points as they stand — bonus is only confirmed once a match is marked as finished."
      />

      <div className="mb-5 flex flex-wrap gap-1">
        {eventIds.map((id) => (
          <Link
            key={id}
            href={`/match-centre?event=${id}`}
            className={cn(
              "num rounded-md px-2.5 py-1 text-[12px] font-semibold transition",
              id === event
                ? "bg-brand-500 text-pitch-950"
                : "bg-pitch-800 text-slate-400 hover:bg-pitch-700 hover:text-white",
            )}
          >
            {id}
          </Link>
        ))}
      </div>

      {!fixtures.length ? (
        <div className="panel px-6 py-12 text-center text-[13.5px] text-slate-400">
          No fixtures scheduled for gameweek {event}.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {fixtures.map((f) => (
            <FixtureCard key={f.id} fixture={f} data={data} liveById={liveById} />
          ))}
        </div>
      )}
    </div>
  );
}

function FixtureCard({
  fixture,
  data,
  liveById,
}: {
  fixture: FplFixture;
  data: Awaited<ReturnType<typeof getGameData>>;
  liveById: Map<number, LiveElement>;
}) {
  const home = data.teams.get(fixture.team_h);
  const away = data.teams.get(fixture.team_a);
  const elements = new Map(data.bootstrap.elements.map((e) => [e.id, e]));

  const statOf = (identifier: string) =>
    fixture.stats.find((s) => s.identifier === identifier) ?? { h: [], a: [] };

  const goals = statOf("goals_scored");
  const assists = statOf("assists");
  const cards = statOf("red_cards");

  // Anyone with recorded BPS in this fixture is in contention for bonus.
  const bpsEntries: { element: number; bps: number }[] = [];
  for (const [id, el] of liveById) {
    const played = el.explain.some((x) => x.fixture === fixture.id);
    if (played && el.stats.bps > 0) bpsEntries.push({ element: id, bps: el.stats.bps });
  }
  bpsEntries.sort((a, b) => b.bps - a.bps);
  const bonusMap = provisionalBonus(bpsEntries);
  const bonusRows = bpsEntries.filter((b) => bonusMap.has(b.element)).slice(0, 6);

  const started = fixture.started || fixture.finished;

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-3 border-b border-pitch-800 px-4 py-3">
        <div className="flex flex-1 items-center justify-end gap-2">
          <span className="text-right text-[14px] font-bold text-white">{home?.name}</span>
          <Image
            src={badgeUrl(home?.code ?? 1)}
            alt=""
            width={24}
            height={24}
            unoptimized
            className="h-6 w-6"
          />
        </div>
        <div className="shrink-0 text-center">
          <div className="num rounded-lg bg-pitch-800 px-3 py-1 text-[16px] font-black text-white">
            {started ? `${fixture.team_h_score ?? 0}–${fixture.team_a_score ?? 0}` : "v"}
          </div>
          <div
            className={cn(
              "mt-1 text-[10px] font-bold uppercase tracking-wide",
              fixture.finished
                ? "text-slate-500"
                : started
                  ? "text-brand-400"
                  : "text-slate-600",
            )}
          >
            {fixture.finished ? "Full time" : started ? `${fixture.minutes}'` : "Upcoming"}
          </div>
        </div>
        <div className="flex flex-1 items-center gap-2">
          <Image
            src={badgeUrl(away?.code ?? 1)}
            alt=""
            width={24}
            height={24}
            unoptimized
            className="h-6 w-6"
          />
          <span className="text-[14px] font-bold text-white">{away?.name}</span>
        </div>
      </div>

      {!started ? (
        <div className="px-4 py-4 text-center text-[12.5px] text-slate-500">
          Kick-off {formatKickoff(fixture.kickoff_time)}
        </div>
      ) : (
        <div className="grid gap-4 px-4 py-3 sm:grid-cols-2">
          <div>
            <SectionLabel>Goals & assists</SectionLabel>
            {goals.h.length + goals.a.length === 0 ? (
              <p className="text-[12px] text-slate-600">No goals yet.</p>
            ) : (
              <ul className="space-y-1">
                {[...goals.h.map((g) => ({ ...g, side: "h" as const })), ...goals.a.map((g) => ({ ...g, side: "a" as const }))].map(
                  (g) => (
                    <li key={`g${g.element}`} className="flex items-center gap-1.5 text-[12.5px]">
                      <span className="text-brand-400">⚽</span>
                      <PlayerLink id={g.element} name={elements.get(g.element)?.web_name ?? "?"} />
                      {g.value > 1 && <span className="text-slate-500">×{g.value}</span>}
                      <span className="ml-auto text-[11px] text-slate-600">
                        {g.side === "h" ? home?.short_name : away?.short_name}
                      </span>
                    </li>
                  ),
                )}
                {[...assists.h.map((g) => ({ ...g, side: "h" as const })), ...assists.a.map((g) => ({ ...g, side: "a" as const }))].map(
                  (g) => (
                    <li key={`a${g.element}`} className="flex items-center gap-1.5 text-[12.5px]">
                      <span className="text-slate-500">🅰</span>
                      <PlayerLink id={g.element} name={elements.get(g.element)?.web_name ?? "?"} />
                      {g.value > 1 && <span className="text-slate-500">×{g.value}</span>}
                      <span className="ml-auto text-[11px] text-slate-600">
                        {g.side === "h" ? home?.short_name : away?.short_name}
                      </span>
                    </li>
                  ),
                )}
                {[...cards.h, ...cards.a].map((c) => (
                  <li key={`r${c.element}`} className="flex items-center gap-1.5 text-[12.5px]">
                    <span className="inline-block h-3 w-2 rounded-[1px] bg-rose-500" />
                    <PlayerLink id={c.element} name={elements.get(c.element)?.web_name ?? "?"} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <SectionLabel>
              {fixture.finished ? "Bonus" : "Provisional bonus"}
            </SectionLabel>
            {!bonusRows.length ? (
              <p className="text-[12px] text-slate-600">Not yet available.</p>
            ) : (
              <ul className="space-y-1">
                {bonusRows.map((b) => {
                  const el = elements.get(b.element);
                  return (
                    <li key={b.element} className="flex items-center gap-2 text-[12.5px]">
                      <span className="num w-4 rounded bg-accent-500/20 text-center text-[11px] font-bold text-accent-400">
                        {bonusMap.get(b.element)}
                      </span>
                      {el && <PositionBadge pos={["", "GKP", "DEF", "MID", "FWD"][el.element_type]} />}
                      <PlayerLink id={b.element} name={el?.web_name ?? "?"} />
                      <span className="num ml-auto text-[11px] text-slate-500">{b.bps} bps</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
      {children}
    </div>
  );
}
