import type { Metadata } from "next";
import Link from "next/link";
import { EntryForm } from "@/components/entry-form";
import { Pitch, SquadList } from "@/components/pitch";
import { InfoTip, PageHeader, PlayerLink, PositionBadge, StatCard } from "@/components/ui";
import { EntryNotFound, InvalidSquad, resolveTeam, teamQueryString } from "@/lib/fpl/entry";
import { cn, money, playerRatingBand, squadRatingBand } from "@/lib/utils";
import { bestXI } from "@/lib/fpl/optimiser";
import { projectForEvent } from "@/lib/fpl/projection";
import { simulateGameweek } from "@/lib/fpl/simulate";
import { getGameData } from "@/lib/fpl/data";
import { benchCounts, chipLabel, chipStatuses } from "@/lib/fpl/chips";
import { getLive } from "@/lib/fpl/client";
import type { LiveElement } from "@/lib/fpl/types";
import { getUserId } from "@/lib/supabase/server";
import { getSavedEntryId, listSquads } from "@/lib/supabase/squads";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "My Team — how your FPL squad looks",
  description:
    "Load your Fantasy Premier League squad to see a rating for every pick, the best starting XI, who to captain and which players are holding you back.",
};

export default async function MyTeamPage({ searchParams }: PageProps<"/my-team">) {
  const params = await searchParams;
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const signedIn = Boolean(await getUserId());
  // ?enter=1 means "I came here to type an ID", so skip the saved-squad autoload that would
  // otherwise replace the form with an analysis of yesterday's squad.
  const wantsForm = Boolean(Array.isArray(params.enter) ? params.enter[0] : params.enter);
  const noInput = !rawId && !params.squad && !wantsForm;

  // With nothing in the URL, fall back to what the account already knows: the saved FPL team
  // id, or failing that the most recently saved squad. Otherwise a signed-in manager lands on
  // an empty form and it looks like their team was lost.
  const savedId = signedIn && noInput ? await getSavedEntryId() : null;
  const savedSquads = signedIn && noInput && !savedId ? await listSquads() : [];
  const autoSquad = savedSquads[0] ?? null;

  const idParam = rawId ?? (savedId ? String(savedId) : undefined);

  const effective: typeof params = autoSquad
    ? {
        ...params,
        squad: autoSquad.playerIds.join(","),
        c: autoSquad.captainId ? String(autoSquad.captainId) : undefined,
        v: autoSquad.viceCaptainId ? String(autoSquad.viceCaptainId) : undefined,
        bank: String(autoSquad.bank),
        name: autoSquad.name,
      }
    : idParam && !rawId
      ? { ...params, id: idParam }
      : params;

  const query = teamQueryString(effective);

  let team;
  try {
    team = await resolveTeam(effective, 5);
  } catch (e) {
    return (
      <div>
        <PageHeader eyebrow="My Team" title="My Team" />
        <EntryForm action="/my-team" defaultValue={idParam} signedIn={signedIn} />
        <div className="panel mt-4 px-5 py-4 text-[13.5px] text-amber-300">
          {e instanceof EntryNotFound || e instanceof InvalidSquad
            ? e.message
            : "Could not load that squad right now. The FPL API may be updating — try again shortly."}
          {e instanceof EntryNotFound && (
            <p className="mt-2 text-slate-300">
              You can{" "}
              <Link href="/squad" className="font-semibold text-brand-400 hover:underline">
                enter your squad manually or import it from a screenshot
              </Link>{" "}
              instead — every tool works exactly the same way.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div>
        <PageHeader
          eyebrow="My Team"
          title="My Team"
          description="Enter your FPL team ID to load your squad. Every player is rated on projected points, how likely they are to play and how kind their fixtures look — then we tell you the best XI, who to captain and which picks are holding you back."
        />
        <EntryForm action="/my-team" signedIn={signedIn} />
        {params.error && (
          <p className="mt-3 text-[13px] text-rose-400">
            That does not look like a valid team ID — it should be digits only.
          </p>
        )}
        {savedSquads.length > 0 && (
          <div className="panel mt-4 px-5 py-4">
            <h2 className="mb-2 text-[13.5px] font-bold text-white">Your saved squads</h2>
            <ul className="divide-y divide-pitch-800">
              {savedSquads.map((sq) => (
                <li key={sq.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">
                    {sq.name}
                  </span>
                  <Link
                    href={`/my-team?squad=${sq.playerIds.join(",")}${
                      sq.captainId ? `&c=${sq.captainId}` : ""
                    }&name=${encodeURIComponent(sq.name)}`}
                    className="rounded-lg border border-pitch-600 px-3 py-1.5 text-[12.5px] font-semibold text-slate-300 transition hover:border-brand-500 hover:text-white"
                  >
                    Rate this squad
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="panel mt-4 px-5 py-4 text-[13.5px] text-slate-300">
          No team ID, or FPL not showing your picks yet?{" "}
          <Link href="/squad" className="font-semibold text-brand-400 hover:underline">
            Build your squad manually or import it from a screenshot →
          </Link>
          {signedIn && !savedSquads.length && (
            <p className="mt-2 text-[12.5px] text-slate-500">
              Nothing is saved to your account yet. Squads are only kept when you build one and
              press <strong className="text-slate-300">Save current squad</strong> — the builder
              itself keeps your squad in the page URL, which is lost once you navigate away.
            </p>
          )}
        </div>
      </div>
    );
  }

  const sorted = [...team.squad].sort((a, b) => b.rating - a.rating);
  const weakest = sorted.slice(-3).reverse();
  const modelXiIds = new Set(team.xi.starters.map((p) => p.id));
  const actualXiIds = new Set(team.actual.starters.map((p) => p.id));
  const benchMistakes = team.xi.starters.filter((p) => !actualXiIds.has(p.id));
  const shouldBench = team.actual.starters.filter((p) => !modelXiIds.has(p.id));
  const captainAdvice = team.xi.captain;
  const captainIsOptimal = captainAdvice?.id === team.captainId;
  const flagged = team.squad.filter((p) => p.status !== "a");

  const squadRating =
    team.squad.reduce((a, p) => a + p.rating, 0) / Math.max(team.squad.length, 1);
  const squadBand = squadRatingBand(squadRating);

  /**
   * A per-gameweek view of the squad: what it actually scored where the week has been played,
   * and what it projects where it has not. Ratings alone describe the squad as it stands
   * today, which says nothing about whether a given week is a good or bad one for it.
   */
  const weeks: { event: number; actual: number | null; projected: number }[] = [];

  // Played weeks get an estimate too, so the chart shows how close the model was.
  const game = await getGameData();
  const elementsById = new Map(game.bootstrap.elements.map((e) => [e.id, e]));
  const chipByEvent = new Map((team.history?.chips ?? []).map((c) => [c.event, c.name]));

  for (const h of team.history?.current ?? []) {
    const perPlayer = team.squad.map((p) => {
      const el = elementsById.get(p.id);
      return el ? projectForEvent(el, game.ctx, h.event) : 0;
    });

    // Under Bench Boost every pick scores, so the estimate has to include the bench.
    const scoped = team.squad.map((p, i) => ({ ...p, xPtsNext: perPlayer[i] }));
    const xi = bestXI(scoped, "xPtsNext", undefined, team.rules);
    const estimate = benchCounts(chipByEvent.get(h.event))
      ? perPlayer.reduce((a, v) => a + v, 0) + (xi.captain?.xPtsNext ?? 0)
      : xi.startingPoints + (xi.captain?.xPtsNext ?? 0);

    weeks.push({
      event: h.event,
      actual: h.points - h.event_transfers_cost,
      projected: estimate,
    });
  }

  // Upcoming weeks: the best XI the current squad can field in that week, plus its captain.
  const upcomingEvents = [
    ...new Set(team.squad.flatMap((p) => p.fixtures.map((f) => f.event))),
  ]
    .sort((a, b) => a - b)
    .slice(0, 5);

  for (const event of upcomingEvents) {
    const scoped = team.squad.map((p) => ({
      ...p,
      xPtsNext: p.fixtures
        .filter((f) => f.event === event)
        .reduce((a, f) => a + f.xPts, 0),
    }));
    const xi = bestXI(scoped, "xPtsNext", undefined, team.rules);
    weeks.push({
      event,
      actual: null,
      projected: xi.startingPoints + (xi.captain?.xPtsNext ?? 0),
    });
  }

  const maxWeek = Math.max(1, ...weeks.flatMap((w) => [w.actual ?? 0, w.projected]));

  // A projection is a mean. What a manager actually wants to know is the range, and how
  // often a big week is even possible with this squad.
  // Live score, when a gameweek is actually in progress.
  let live: LiveElement[] = [];
  if (team.source === "fpl") {
    try {
      live = (await getLive(team.event)).elements;
    } catch {
      live = [];
    }
  }
  const liveById = new Map(live.map((e) => [e.id, e.stats]));
  const livePoints = team.picks.reduce(
    (a, p) => a + (liveById.get(p.element)?.total_points ?? 0) * p.multiplier,
    0,
  );
  const anyMinutes = team.picks.some((p) => (liveById.get(p.element)?.minutes ?? 0) > 0);
  const toPlay = team.picks
    .filter((p) => p.position <= 11)
    .filter((p) => (liveById.get(p.element)?.minutes ?? 0) === 0).length;

  const chips = chipStatuses(team.history?.chips ?? [], team.event);
  const chipsLeft = chips.filter((c) => c.available).length;
  const chipsUsed = chips.filter((c) => c.usedIn !== null);

  const nextEventId = game.ctx.nextEvent;
  const outcome = simulateGameweek(
    team.actual.starters,
    team.squad.find((p) => p.id === team.captainId) ?? team.xi.captain,
    game.ctx,
    nextEventId,
  );
  const withTripleCaptain = simulateGameweek(
    team.actual.starters,
    team.squad.find((p) => p.id === team.captainId) ?? team.xi.captain,
    game.ctx,
    nextEventId,
    { captainMultiplier: 3 },
  );
  const withBenchBoost = simulateGameweek(
    team.actual.starters,
    team.squad.find((p) => p.id === team.captainId) ?? team.xi.captain,
    game.ctx,
    nextEventId,
    { bench: team.actual.bench },
  );
  const scored = weeks.filter((w) => w.actual !== null);
  const totalActual = scored.reduce((a, w) => a + (w.actual ?? 0), 0);
  const totalEstimate = scored.reduce((a, w) => a + w.projected, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My Team"
        badge={chipLabel(team.activeChip)}
        title={team.name}
        description={
          team.source === "manual"
            ? `Hand-built squad · projections for gameweek ${team.event}`
            : `${team.managerName} · squad as of gameweek ${team.event}`
        }
      >
        <Link
          href={`/transfers?${query}`}
          className="rounded-lg bg-brand-500 px-4 py-2 text-[13px] font-bold text-pitch-950 transition hover:bg-brand-400"
        >
          See transfers →
        </Link>
        <Link
          href={team.source === "manual" ? `/planner?${query}` : `/live?${query}`}
          className="rounded-lg border border-pitch-600 px-4 py-2 text-[13px] font-bold text-slate-300 transition hover:border-brand-500 hover:text-white"
        >
          {team.source === "manual" ? "Planner" : "Live rank"}
        </Link>
        {team.source === "manual" && (
          <Link
            href={`/squad?${query}`}
            className="rounded-lg border border-pitch-600 px-4 py-2 text-[13px] font-bold text-slate-300 transition hover:border-brand-500 hover:text-white"
          >
            Edit squad
          </Link>
        )}
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {anyMinutes ? (
          <StatCard
            label={`Gameweek ${team.event} so far`}
            value={livePoints - team.eventTransfersCost}
            sub={toPlay ? `${toPlay} still to play` : "All players done"}
            tone="brand"
          />
        ) : team.source === "fpl" ? (
          <StatCard
            label="Total points"
            value={(team.overallPoints ?? 0).toLocaleString("en-GB")}
            sub={
              team.overallRank ? `Rank ${team.overallRank.toLocaleString("en-GB")}` : "Unranked"
            }
          />
        ) : (
          <StatCard label="Squad" value="Built by hand" sub="Not linked to an FPL team" />
        )}
        <StatCard
          label="Squad value"
          value={money(team.squadValue)}
          sub={`${money(team.bank)} in the bank`}
        />
        <StatCard
          label="Free transfers"
          value={team.freeTransfers}
          sub={chipsLeft ? `${chipsLeft} chips left` : "No chips left"}
        />
        <StatCard
          label="Squad rating"
          value={
            <>
              {squadRating.toFixed(1)}
              <span className="text-[13px] font-semibold text-slate-600"> / 10</span>
            </>
          }
          valueClassName={squadBand.text}
          sub={`${squadBand.label} · average across 15 players`}
          info={
            <>
              Every player gets a score out of 10 for points, value and how likely they are to
              play. This is the average across all 15 of yours.
              <span className="mt-1.5 block text-slate-400">
                Your bench and your cheap fill-in players drag the average down, so nobody
                scores 10. About <strong className="text-brand-400">6.5</strong> is as good as
                it gets — that is what the best possible £100m squad would score.
              </span>
              <span className="mt-1.5 block text-slate-500">
                6.0+ elite · 5.0+ strong · 4.0+ fair · below 4 weak
              </span>
            </>
          }
        />
        <StatCard
          label="Projected next GW"
          value={(team.xi.startingPoints + (captainAdvice?.xPtsNext ?? 0)).toFixed(1)}
          sub={`Best XI ${team.xi.formation} incl. captain`}
          tone="brand"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
        <section>
          <h2 className="mb-2.5 text-[14px] font-bold text-white">
            Your XI as picked{" "}
            <span className="font-normal text-slate-500">({team.actual.formation})</span>
          </h2>
          <Pitch
            xi={team.actual}
            captainId={team.captainId ?? undefined}
            viceCaptainId={team.viceCaptainId ?? undefined}
            teamCodes={team.teamCodes}
          />
        </section>

        <section className="space-y-4">
          <div className="panel px-5 py-4">
            <h2 className="mb-2 text-[14px] font-bold text-white">Verdict</h2>
            <ul className="space-y-2.5 text-[13px] leading-relaxed">
              <Verdict tone={captainIsOptimal ? "good" : "warn"}>
                {captainIsOptimal ? (
                  <>
                    Good captain pick — <strong>{captainAdvice?.name}</strong> is your highest
                    projected starter at {captainAdvice?.xPtsNext.toFixed(2)} points.
                  </>
                ) : (
                  <>
                    Consider captaining <strong>{captainAdvice?.name}</strong> (
                    {captainAdvice?.xPtsNext.toFixed(2)} pts) instead — worth about{" "}
                    {(
                      (captainAdvice?.xPtsNext ?? 0) -
                      (team.squad.find((p) => p.id === team.captainId)?.xPtsNext ?? 0)
                    ).toFixed(2)}{" "}
                    points.
                  </>
                )}
              </Verdict>

              <Verdict tone={benchMistakes.length ? "warn" : "good"}>
                {benchMistakes.length ? (
                  <>
                    Start{" "}
                    {benchMistakes.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && ", "}
                        <strong>{p.name}</strong>
                      </span>
                    ))}{" "}
                    over{" "}
                    {shouldBench.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && ", "}
                        {p.name}
                      </span>
                    ))}{" "}
                    — worth {(team.xi.startingPoints - team.actual.startingPoints).toFixed(2)}{" "}
                    points in the best {team.xi.formation}.
                  </>
                ) : (
                  <>Your starting XI is already the best one available.</>
                )}
              </Verdict>

              <Verdict tone={flagged.length ? "bad" : "good"}>
                {flagged.length ? (
                  <>
                    {flagged.length} flagged player{flagged.length > 1 ? "s" : ""}:{" "}
                    {flagged.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && ", "}
                        <strong>{p.name}</strong>
                        {p.availability !== null ? ` (${p.availability}%)` : ""}
                      </span>
                    ))}
                    .
                  </>
                ) : (
                  <>No injury or suspension flags in your 15.</>
                )}
              </Verdict>

              <Verdict tone="warn">
                Weakest links by rating:{" "}
                {weakest.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && ", "}
                    <strong>{p.name}</strong> ({p.rating.toFixed(1)})
                  </span>
                ))}
                . See the{" "}
                <Link href={`/transfers?${query}`} className="text-brand-400 hover:underline">
                  transfer suggestions
                </Link>
                .
              </Verdict>
            </ul>
          </div>

          <div className="panel px-5 py-4">
            <h2 className="mb-2.5 flex items-center gap-1.5 text-[14px] font-bold text-white">
              Player ratings
              <InfoTip label="About player ratings">
                Each player is scored out of 10 on the points we expect, what they cost, and
                how safe their place in the team is. These spread much wider than the squad
                average: a typical regular starter is around 3.3, and only the very best
                expensive players reach 9 or 10.
                <span className="mt-1.5 block text-slate-500">
                  7.0+ elite · 5.0+ strong · 3.0+ fair · below 3 weak
                </span>
              </InfoTip>
            </h2>
            <ol className="space-y-1.5">
              {sorted.map((p) => (
                <li key={p.id} className="flex items-center gap-2.5 text-[12.5px]">
                  <PositionBadge pos={p.pos} />
                  <PlayerLink id={p.id} name={p.name} />
                  <span className="text-[11px] text-slate-500">{p.team}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-pitch-700">
                      <div
                        className={cn("h-full rounded-full", playerRatingBand(p.rating).bar)}
                        style={{ width: `${Math.min(100, (p.rating / 10) * 100)}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "num w-7 text-right font-bold",
                        playerRatingBand(p.rating).text,
                      )}
                    >
                      {p.rating.toFixed(1)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>

      <section className="panel px-5 py-4">
        <h2 className="mb-1 flex items-center gap-1.5 text-[14px] font-bold text-white">
          What this squad could score
          <InfoTip label="About the range">
            We play out this gameweek four thousand times, rolling the dice each time on who
            starts, who scores, who assists, who keeps a clean sheet and who picks up bonus.
            <span className="mt-1.5 block text-slate-400">
              A single projected number is only the average. Real weeks are streaky — a good
              return lands 4 to 13 points in one go — so when you need a big score, the range
              matters more than the average.
            </span>
          </InfoTip>
        </h2>
        <p className="mb-4 text-[12px] text-slate-500">
          Gameweek {nextEventId}, based on your XI as picked.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Typical week" value={outcome.median} sub="Half your weeks land near here" />
          <StatCard
            label="Usual range"
            value={`${outcome.lower}–${outcome.upper}`}
            sub="The middle half of outcomes"
          />
          <StatCard label="Good week" value={outcome.p90} sub="Top 10% for this squad" tone="brand" />
          <StatCard label="Great week" value={outcome.p99} sub="Top 1% for this squad" tone="brand" />
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-[12.5px]">
            <thead>
              <tr className="border-b border-pitch-800 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="py-1.5 text-left">Chance of</th>
                <th className="text-right">As picked</th>
                <th className="text-right">Triple Captain</th>
                <th className="text-right">Bench Boost</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["60+ points", "chanceOf60"],
                  ["80+ points", "chanceOf80"],
                  ["100+ points", "chanceOf100"],
                ] as const
              ).map(([label, key]) => (
                <tr key={key} className="border-b border-pitch-800/50">
                  <td className="py-1.5 text-slate-400">{label}</td>
                  <td className="num py-1.5 text-right font-semibold text-white">
                    {(outcome[key] * 100).toFixed(1)}%
                  </td>
                  <td className="num py-1.5 text-right text-brand-400">
                    {(withTripleCaptain[key] * 100).toFixed(1)}%
                  </td>
                  <td className="num py-1.5 text-right text-brand-400">
                    {(withBenchBoost[key] * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-[11.5px] leading-relaxed text-slate-500">
          Chips improve your odds, but they do not transform them. What really decides a big
          week is the squad itself — see{" "}
          <Link href={`/transfers?${query}`} className="text-brand-400 hover:underline">
            See transfers
          </Link>{" "}
          for what would raise this ceiling.
        </p>
      </section>

      <section className="panel px-5 py-4">
        <h2 className="mb-1 flex items-center gap-1.5 text-[14px] font-bold text-white">
          Gameweek by gameweek
          <InfoTip label="About gameweek by gameweek">
            Each played week shows our estimate beside what you actually scored, after
            transfer hits, with the difference underneath. Upcoming weeks show the estimate
            alone.
            <span className="mt-1.5 block text-slate-400">
              For weeks already played, the estimate is worked out now — using results it
              would not have known at the time. So it is a rough sense check, not a record of
              what we would have told you before the deadline.
            </span>
          </InfoTip>
        </h2>
        <p className="mb-4 text-[12px] text-slate-500">
          Played weeks show our estimate against what you actually scored; upcoming weeks show
          the estimate alone.
        </p>

        <div className="flex items-end gap-2 overflow-x-auto pb-1">
          {weeks.map((w) => (
            <div key={w.event} className="flex min-w-[52px] flex-1 flex-col items-center gap-1">
              {/* Both numbers, in the same order as the bars beneath them. */}
              <span className="num flex items-baseline gap-1 text-[11px] font-bold leading-none">
                <span className="text-slate-400">{w.projected.toFixed(0)}</span>
                {w.actual !== null && (
                  <>
                    <span className="text-slate-600">/</span>
                    <span className="text-white">{w.actual}</span>
                  </>
                )}
              </span>

              <div className="flex h-[120px] w-full items-end justify-center gap-[3px]">
                <div
                  title={`GW${w.event}: ${w.projected.toFixed(1)} projected`}
                  className="w-full rounded-t border border-dashed border-brand-500/50 bg-brand-500/10"
                  style={{ height: `${Math.max(4, (w.projected / maxWeek) * 120)}px` }}
                />
                {w.actual !== null && (
                  <div
                    title={`GW${w.event}: ${w.actual} actually scored`}
                    className="w-full rounded-t bg-brand-500"
                    style={{ height: `${Math.max(4, (w.actual / maxWeek) * 120)}px` }}
                  />
                )}
              </div>

              <span className="text-[10px] font-semibold text-slate-500">GW{w.event}</span>
              {w.actual !== null && (
                <span
                  className={cn(
                    "num text-[10px] font-bold",
                    w.actual - w.projected >= 0 ? "text-brand-400" : "text-rose-400",
                  )}
                >
                  {w.actual - w.projected >= 0 ? "+" : ""}
                  {(w.actual - w.projected).toFixed(0)}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm border border-dashed border-brand-500/50 bg-brand-500/10" />
            Our estimate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-brand-500" />
            Actually scored
          </span>
          {scored.length > 0 && (
            <span className="ml-auto">
              Across {scored.length} played week{scored.length === 1 ? "" : "s"}: estimated{" "}
              <strong className="num text-slate-300">{totalEstimate.toFixed(0)}</strong>, scored{" "}
              <strong className="num text-white">{totalActual}</strong>
            </span>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 text-[14px] font-bold text-white">Squad detail</h2>
        <SquadList players={team.squad} teamCodes={team.teamCodes} />
      </section>

      {team.history?.current?.length ? (
        <section className="panel px-5 py-4">
          <h2 className="mb-1 text-[14px] font-bold text-white">Your season</h2>
          <p className="mb-3 text-[12px] text-slate-500">Every gameweek you have played.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[12.5px]">
              <thead>
                <tr className="border-b border-pitch-800 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="py-1.5 text-left">GW</th>
                  <th className="text-right">Points</th>
                  <th className="text-right">On bench</th>
                  <th className="text-right">Transfers</th>
                  <th className="text-right">Rank</th>
                  <th className="text-right">Chip</th>
                </tr>
              </thead>
              <tbody>
                {[...team.history.current].reverse().map((h) => {
                  const chip = (team.history?.chips ?? []).find((c) => c.event === h.event);
                  return (
                    <tr key={h.event} className="border-b border-pitch-800/50">
                      <td className="num py-1.5 text-slate-400">{h.event}</td>
                      <td className="num py-1.5 text-right font-bold text-white">
                        {h.points - h.event_transfers_cost}
                      </td>
                      <td className="num py-1.5 text-right text-slate-500">{h.points_on_bench}</td>
                      <td className="num py-1.5 text-right text-slate-400">
                        {h.event_transfers}
                        {h.event_transfers_cost ? ` (\u2212${h.event_transfers_cost})` : ""}
                      </td>
                      <td className="num py-1.5 text-right text-slate-400">
                        {h.overall_rank?.toLocaleString("en-GB") ?? "\u2014"}
                      </td>
                      <td className="py-1.5 text-right text-[11.5px] text-accent-400">
                        {chip ? chipLabel(chip.name) : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {chipsUsed.length > 0 && (
            <p className="mt-3 border-t border-pitch-800 pt-2.5 text-[11.5px] text-slate-500">
              Chips played: {chipsUsed.map((c) => `${c.label} (GW${c.usedIn})`).join(", ")}.
              {chipsLeft > 0 && ` ${chipsLeft} left.`}
            </p>
          )}
        </section>
      ) : null}

      <EntryForm
        action="/my-team"
        defaultValue={idParam}
        label={team.source === "fpl" ? "FPL Team ID" : "Load an FPL team instead"}
        cta={team.source === "fpl" ? "Load another team" : "Load team"}
        signedIn={signedIn}
      />
    </div>
  );
}

function Verdict({
  tone,
  children,
}: {
  tone: "good" | "warn" | "bad";
  children: React.ReactNode;
}) {
  const dot =
    tone === "good" ? "bg-brand-400" : tone === "warn" ? "bg-amber-400" : "bg-rose-500";
  return (
    <li className="flex gap-2.5 text-slate-300">
      <span className={cn("mt-[6px] h-2 w-2 shrink-0 rounded-full", dot)} />
      <span>{children}</span>
    </li>
  );
}
