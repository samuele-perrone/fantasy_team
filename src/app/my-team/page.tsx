import type { Metadata } from "next";
import Link from "next/link";
import { EntryForm } from "@/components/entry-form";
import { Pitch, SquadList } from "@/components/pitch";
import { InfoTip, PageHeader, PlayerLink, PositionBadge, StatCard } from "@/components/ui";
import { EntryNotFound, InvalidSquad, resolveTeam, teamQueryString } from "@/lib/fpl/entry";
import { cn, money, playerRatingBand, squadRatingBand } from "@/lib/utils";
import { chipLabel } from "@/lib/fpl/chips";
import { bestXI } from "@/lib/fpl/optimiser";
import { getUserId } from "@/lib/supabase/server";
import { getSavedEntryId, listSquads } from "@/lib/supabase/squads";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Pick & Rating — Rate my FPL team",
  description:
    "Load your Fantasy Premier League squad and get a rating for every pick, the optimal starting XI, captaincy advice and the weak links to move on.",
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
        <PageHeader eyebrow="My Team" title="Pick & Rating" />
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
          title="Pick & Rating"
          description="Enter your FPL team ID to load your squad. Every player is rated on projected points, minutes security and fixture run, and the model tells you the best XI, captain and the picks holding you back."
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
  const weeks: { event: number; actual: number | null; projected: number | null }[] = [];

  for (const h of team.history?.current ?? []) {
    weeks.push({ event: h.event, actual: h.points - h.event_transfers_cost, projected: null });
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
    const xi = bestXI(scoped, "xPtsNext");
    weeks.push({
      event,
      actual: null,
      projected: xi.startingPoints + (xi.captain?.xPtsNext ?? 0),
    });
  }

  const maxWeek = Math.max(1, ...weeks.map((w) => w.actual ?? w.projected ?? 0));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My Team"
        badge={chipLabel(team.activeChip)}
        title={team.name}
        description={
          team.source === "manual"
            ? `Hand-built squad · projections for gameweek ${team.event}`
            : `${team.managerName} · squad as at gameweek ${team.event}`
        }
      >
        <Link
          href={`/transfers?${query}`}
          className="rounded-lg bg-brand-500 px-4 py-2 text-[13px] font-bold text-pitch-950 transition hover:bg-brand-400"
        >
          AI transfers →
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
        {team.source === "fpl" ? (
          <StatCard
            label="Overall points"
            value={(team.overallPoints ?? 0).toLocaleString("en-GB")}
            sub={
              team.overallRank ? `Rank ${team.overallRank.toLocaleString("en-GB")}` : "Unranked"
            }
          />
        ) : (
          <StatCard
            label="Squad source"
            value="Manual"
            sub="Built by hand — not linked to an FPL entry"
          />
        )}
        <StatCard
          label="Squad value"
          value={money(team.squadValue)}
          sub={`${money(team.bank)} in the bank`}
        />
        <StatCard
          label="Free transfers"
          value={team.freeTransfers}
          sub={team.source === "fpl" ? "Estimated from history" : "Assumed"}
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
              Each player scores 0–10 on projected points, value for money and how likely they
              are to start. This is the average across your 15.
              <span className="mt-1.5 block text-slate-400">
                Because it includes your bench and cheap enablers, the realistic ceiling is
                about <strong className="text-brand-400">6.5</strong> — that is what a
                fully optimised £100m squad scores.
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
                    Captaincy is optimal — <strong>{captainAdvice?.name}</strong> is your highest
                    projected starter at {captainAdvice?.xPtsNext.toFixed(2)} xPts.
                  </>
                ) : (
                  <>
                    Consider captaining <strong>{captainAdvice?.name}</strong> (
                    {captainAdvice?.xPtsNext.toFixed(2)} xPts) instead — worth about{" "}
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
                    points in the model&apos;s {team.xi.formation}.
                  </>
                ) : (
                  <>Your starting XI already matches the model&apos;s optimal lineup.</>
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
                  AI transfer suggestions
                </Link>
                .
              </Verdict>
            </ul>
          </div>

          <div className="panel px-5 py-4">
            <h2 className="mb-2.5 flex items-center gap-1.5 text-[14px] font-bold text-white">
              Player ratings
              <InfoTip label="About player ratings">
                Each player is scored 0–10 on projected points, points per £m and minutes
                security. Individuals spread much wider than the squad average — the median
                regular starter sits near 3.3, and only the best premiums reach 9–10.
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
          Gameweek by gameweek
          <InfoTip label="About gameweek by gameweek">
            Solid bars are points this squad actually scored, net of any transfer hits. Hollow
            bars are what it projects in weeks still to come, using the best eleven it could
            field that week plus its captain.
          </InfoTip>
        </h2>
        <p className="mb-4 text-[12px] text-slate-500">
          Played weeks show what you scored; upcoming weeks show what this squad projects.
        </p>

        <div className="flex items-end gap-2 overflow-x-auto pb-1">
          {weeks.map((w) => {
            const value = w.actual ?? w.projected ?? 0;
            return (
              <div key={w.event} className="flex min-w-[46px] flex-1 flex-col items-center gap-1">
                <span
                  className={cn(
                    "num text-[11px] font-bold",
                    w.actual !== null ? "text-white" : "text-slate-400",
                  )}
                >
                  {value.toFixed(w.actual !== null ? 0 : 1)}
                </span>
                <div
                  title={
                    w.actual !== null
                      ? `GW${w.event}: ${w.actual} points scored`
                      : `GW${w.event}: ${value.toFixed(1)} projected`
                  }
                  className={cn(
                    "w-full rounded-t",
                    w.actual !== null
                      ? "bg-brand-500"
                      : "border border-dashed border-brand-500/50 bg-brand-500/10",
                  )}
                  style={{ height: `${Math.max(4, (value / maxWeek) * 120)}px` }}
                />
                <span className="text-[10px] font-semibold text-slate-500">GW{w.event}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 text-[14px] font-bold text-white">Squad detail</h2>
        <SquadList players={team.squad} teamCodes={team.teamCodes} />
      </section>

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
