import "server-only";
import type { LoadedTeam } from "@/lib/fpl/entry";
import type { PlayerRow } from "@/lib/fpl/row";
import { planTransfers } from "@/lib/fpl/optimiser";
import { chipStatuses } from "@/lib/fpl/chips";
import { getGameData } from "@/lib/fpl/data";
import { projectPlayer } from "@/lib/fpl/projection";
import { expectedGoals } from "@/lib/fpl/ratings";
import { money } from "@/lib/utils";

/**
 * The squad, its projections and the optimiser's own conclusions, written out as text for the
 * model to reason over.
 *
 * The model is deliberately *not* asked to do the maths. Everything numeric here — projected
 * points, ratings, the ranked transfer plans, whether a hit is worth taking — is computed by
 * the same code that renders the pages, so the chat can never contradict the rest of the site.
 * The model's job is to explain, compare and answer follow-ups over settled numbers.
 */

function detail(p: PlayerRow): string {
  const bits = [
    `${p.name} (${p.pos}, ${p.team}, ${money(p.cost)})`,
    `next GW ${p.xPtsNext.toFixed(2)}pts`,
    `next 5 ${p.xPts.toFixed(1)}pts`,
    `${p.xMins} mins expected`,
    `${Math.round(p.startProb * 100)}% to start`,
    // Season minutes and starts answer "has he actually been playing?", which a projection
    // alone cannot — a low-minutes player can still project well on rate stats.
    `season: ${p.starts} start${p.starts === 1 ? "" : "s"}, ${p.minutes} mins played`,
    `rating ${p.rating.toFixed(1)}/10`,
  ];
  if (p.status !== "a") {
    // FPL's news string usually already contains the percentage, so only append it when it
    // does not — otherwise the line reads "75% chance of playing — 75% chance of playing".
    const news = p.news || "no detail given";
    const hasPct = p.availability !== null && news.includes(`${p.availability}%`);
    bits.push(
      `FLAGGED (${p.status}): ${news}` +
        (p.availability !== null && !hasPct ? ` — ${p.availability}% chance of playing` : ""),
    );
  }
  return bits.join(" · ");
}

function line(p: PlayerRow, extra?: string): string {
  return `- ${detail(p)}${extra ? ` · ${extra}` : ""}`;
}

/**
 * The match each of the manager's players is actually involved in this week: who is favourite,
 * how many goals each side is expected to score, and each player's own chance of a goal or
 * assist.
 *
 * A per-player points projection alone reads as a number with no story behind it. "Man Utd are
 * favourites at home to Ipswich, 2.1 goals to 0.9, and Bruno has a 42% chance of a goal or
 * assist" is the same model output in the terms a manager actually thinks in — and it lets the
 * assistant answer "who's most likely to score?" rather than deflecting.
 */
async function matchContext(team: LoadedTeam): Promise<string[]> {
  const data = await getGameData();
  const elementsById = new Map(data.bootstrap.elements.map((e) => [e.id, e]));
  const out: string[] = [];

  interface Involved {
    player: PlayerRow;
    goalProb: number;
    assistProb: number;
    returnProb: number;
    cleanSheetProb: number;
  }
  // Keyed by fixture so team-mates are grouped under one match rather than repeated.
  const byFixture = new Map<
    number,
    { event: number; home: number; away: number; players: Involved[] }
  >();

  for (const p of team.squad) {
    const el = elementsById.get(p.id);
    if (!el) continue;
    // horizon 1 yields the player's next fixture, or two in a double gameweek. Filtering on
    // team.event would find nothing: that is the week whose picks are locked, while the
    // projections describe the week still to come.
    const proj = projectPlayer(el, data.ctx, 1);
    for (const f of proj.fixtures) {
      const home = f.isHome ? p.teamId : f.opponent;
      const away = f.isHome ? f.opponent : p.teamId;
      const entry = byFixture.get(f.fixtureId) ?? {
        event: f.event,
        home,
        away,
        players: [],
      };
      entry.players.push({
        player: p,
        goalProb: f.goalProb,
        assistProb: f.assistProb,
        returnProb: f.returnProb,
        cleanSheetProb: f.cleanSheetProb,
      });
      byFixture.set(f.fixtureId, entry);
    }
  }

  if (!byFixture.size) return out;

  const name = (id: number) => data.teams.get(id)?.name ?? "?";

  out.push("");
  const ev = [...byFixture.values()][0]?.event;
  out.push(`NEXT GAMEWEEK (GW${ev}) — the matches your players are involved in:`);
  for (const fx of byFixture.values()) {
    const homeR = data.ctx.ratings.get(fx.home);
    const awayR = data.ctx.ratings.get(fx.away);
    let headline = `${name(fx.home)} v ${name(fx.away)}`;
    if (homeR && awayR) {
      const hg = expectedGoals(homeR, awayR, true);
      const ag = expectedGoals(awayR, homeR, false);
      const margin = hg - ag;
      const favourite =
        Math.abs(margin) < 0.25
          ? "too close to call"
          : `${margin > 0 ? name(fx.home) : name(fx.away)} favourite`;
      headline += ` — ${favourite}, expected goals ${hg.toFixed(2)} v ${ag.toFixed(2)}`;
    }
    out.push(`- ${headline}`);
    for (const inv of fx.players) {
      out.push(
        `    ${inv.player.name} (${inv.player.pos}): ` +
          `${Math.round(inv.returnProb * 100)}% chance of a goal or assist ` +
          `(goal ${Math.round(inv.goalProb * 100)}%, assist ${Math.round(inv.assistProb * 100)}%)` +
          (inv.player.posId <= 2
            ? `, ${Math.round(inv.cleanSheetProb * 100)}% clean sheet`
            : ""),
      );
    }
  }

  const likeliest = [...byFixture.values()]
    .flatMap((f) => f.players)
    .sort((a, b) => b.returnProb - a.returnProb)
    .slice(0, 5);
  if (likeliest.length) {
    out.push("");
    out.push(
      "MOST LIKELY TO SCORE OR ASSIST this week: " +
        likeliest
          .map((i) => `${i.player.name} ${Math.round(i.returnProb * 100)}%`)
          .join(", ") +
        ".",
    );
  }

  return out;
}

export async function buildSquadBrief(team: LoadedTeam): Promise<string> {
  const captain = team.squad.find((p) => p.id === team.captainId);
  const vice = team.squad.find((p) => p.id === team.viceCaptainId);
  const best = team.xi.captain;

  const plans = planTransfers(
    team.squad,
    team.pool.filter(
      (p) =>
        !team.squad.some((s) => s.id === p.id) &&
        p.status !== "u" &&
        p.status !== "n" &&
        p.xMins > 20,
    ),
    {
      bank: team.bank,
      freeTransfers: team.freeTransfers,
      maxTransfers: 3,
      key: "xPts",
      rules: team.rules,
    },
  );

  const chips = chipStatuses(team.history?.chips ?? [], team.event);
  const startersIds = new Set(team.actual.starters.map((p) => p.id));

  const out: string[] = [];

  // Team news moves during the day — a flag can be added or lifted between two questions in
  // the same conversation. Stamping the brief lets the model say how fresh its picture is
  // instead of implying that "no flag" is a settled fact.
  out.push(
    `Team news and prices below were read from FPL at ` +
      `${new Date().toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" })} UK time. ` +
      `FPL adds and removes flags through the day, usually around press conferences, so a ` +
      `player unflagged here may have been flagged an hour ago or may be flagged an hour from now.`,
  );

  // The squad on file belongs to team.event; the advice is about the week after it. Saying so
  // explicitly stops the model advising on a gameweek that is already locked.
  out.push(
    `The squad below is as it stood in GW${team.event}. Advice should be about the NEXT ` +
      `gameweek, whose fixtures are listed further down — not about GW${team.event}, which is done.`,
  );
  out.push(
    `Manager: ${team.managerName ?? "unknown"}. Team: ${team.name}. ` +
      `Squad value ${money(team.squadValue)}, ${money(team.bank)} in the bank, ` +
      `${team.freeTransfers} free transfer${team.freeTransfers === 1 ? "" : "s"}.`,
  );
  if (team.overallPoints !== null) {
    out.push(
      `Season so far: ${team.overallPoints} points, overall rank ` +
        `${team.overallRank?.toLocaleString("en-GB") ?? "n/a"}.`,
    );
  }
  if (team.activeChip) out.push(`Chip active this week: ${team.activeChip}.`);

  out.push("");
  out.push(`STARTING XI (${team.actual.formation}) as currently set:`);
  for (const p of team.actual.starters) {
    const marks = [
      p.id === team.captainId ? "CAPTAIN" : null,
      p.id === team.viceCaptainId ? "VICE" : null,
    ].filter(Boolean).join(", ");
    out.push(line(p, marks || undefined));
  }

  out.push("");
  out.push("BENCH, in order:");
  team.actual.bench.forEach((p, i) => out.push(line(p, `bench ${i + 1}`)));

  out.push(...(await matchContext(team)));

  // What actually happened, as distinct from what is projected. A manager asking "who should I
  // move on?" is usually reacting to last week, so the assistant needs to have seen it too.
  const history = team.history?.current ?? [];
  const last = history.length ? history[history.length - 1] : null;
  if (last) {
    out.push("");
    out.push(
      `LAST GAMEWEEK (GW${last.event}): you scored ${last.points} points` +
        (last.event_transfers_cost ? ` after a ${last.event_transfers_cost}-point hit` : "") +
        `, overall rank ${last.overall_rank?.toLocaleString("en-GB") ?? "n/a"}.`,
    );
    const scorers = [...team.squad]
      .filter((p) => p.eventPoints > 0)
      .sort((a, b) => b.eventPoints - a.eventPoints)
      .slice(0, 8);
    if (scorers.length) {
      out.push(
        `  Your scorers: ${scorers.map((p) => `${p.name} ${p.eventPoints}`).join(", ")}.`,
      );
    }
    const blanks = team.squad.filter((p) => p.eventPoints <= 0);
    if (blanks.length) {
      out.push(`  Returned nothing: ${blanks.map((p) => p.name).join(", ")}.`);
    }
  }

  out.push("");
  out.push("OUR OWN CONCLUSIONS (already computed — use these, do not recalculate):");
  out.push(
    `- Best XI from these 15 is ${team.xi.formation}, projected ${team.xi.startingPoints.toFixed(1)}pts ` +
      `vs ${team.actual.startingPoints.toFixed(1)}pts for the XI as set.`,
  );
  const swaps = team.xi.starters.filter((p) => !startersIds.has(p.id));
  if (swaps.length) {
    out.push(`- Should be starting instead: ${swaps.map((p) => p.name).join(", ")}.`);
  } else {
    out.push("- The XI as set is already the best available.");
  }
  if (best && captain && best.id !== captain.id) {
    out.push(
      `- Better captain: ${best.name} (${best.xPtsNext.toFixed(2)}) over ${captain.name} ` +
        `(${captain.xPtsNext.toFixed(2)}) — worth about ${(best.xPtsNext - captain.xPtsNext).toFixed(2)}pts.`,
    );
  } else if (captain) {
    out.push(`- ${captain.name} is already the best captain pick. Vice is ${vice?.name ?? "unset"}.`);
  }

  out.push("");
  out.push(
    `RANKED TRANSFER PLANS over the next 5 gameweeks. The manager has ` +
      `${team.freeTransfers} free transfer${team.freeTransfers === 1 ? "" : "s"}, so the first ` +
      `${team.freeTransfers} move${team.freeTransfers === 1 ? "" : "s"} cost nothing; each move ` +
      `beyond that costs 4 points. The "hit" figure below is the real cost of that plan — a hit ` +
      `of 0 means NO points are deducted.`,
  );
  if (!plans.length) {
    out.push("- No transfer improves the squad.");
  }
  for (const [i, plan] of plans.entries()) {
    out.push(
      `PLAN ${i + 1} — ${plan.moves.length} transfer(s): gain ${plan.gain.toFixed(2)}, ` +
        `hit ${plan.hitCost} (${plan.hitCost === 0 ? "FREE, no points deducted" : `costs ${plan.hitCost} points`})` +
        `, net ${plan.netGain.toFixed(2)}`,
    );
    // Incoming players get the same detail as the manager's own, or the model has no way to
    // judge whether a suggested signing is injured, rotated or simply not playing.
    for (const m of plan.moves) {
      out.push(`    OUT: ${detail(m.out)}`);
      out.push(`    IN:  ${detail(m.in)}`);
    }
  }

  out.push("");
  out.push("CHIPS (two of each per season — one for GW1-19, one for GW20-38):");
  for (const c of chips) {
    const state = c.usedIn
      ? `played in GW${c.usedIn}`
      : c.expired
        ? "expired unused"
        : c.available
          ? `available, usable GW${c.firstEvent}-${c.lastEvent}`
          : `not yet usable (GW${c.firstEvent}-${c.lastEvent})`;
    out.push(`- ${c.label} (half ${c.half}): ${state}`);
  }

  return out.join("\n");
}

export const SYSTEM_PROMPT = `You are the assistant inside FantasyTeamHub, a Fantasy Premier League site. You are talking to the manager whose squad is described below.

The brief below gives you, for this gameweek: every player you own with their minutes, start chance, injury news and season record; the actual match each of them plays, which side is favourite and by how many expected goals; each player's chance of a goal or assist; what happened last gameweek; ranked transfer plans with their real cost; and the chip situation. Ground every answer in it.

How to answer:
- Lead with the football, not the projection. "Man Utd are big favourites at home and Bruno has the best chance of a return in your squad" reads better than "Bruno projects 7.29".
- Talk about football, not models. Say "points", "minutes", "chance of starting", "how hard the fixture is". Never say xPts, xMins, xG, FDR, BPS, expected value, variance, or calibration.
- Be direct and short. Two or three sentences for a simple question. Lead with the answer, then one line of why.
- Use the numbers in the brief. They come from the same projections the rest of the site shows, so your answer must agree with what the manager can see on the page. Never invent a number, a fixture, an injury or a price.
- Do not accept a false premise in the question. If the manager asks "is it worth a -4 for X" but the brief shows that move costs no hit, correct them: say it is free and they are not paying 4 points. Check the hit figure in the brief before discussing any cost.
- A points hit costs 4 points for certain. Our per-player estimates are typically off by about 1.6 points a week, so if a plan's gain does not clearly beat the hit, say to hold. Do not talk anyone into a -4 for a marginal gain.
- Whenever you recommend signing a player, state their availability in the same breath if there is anything to flag: a FLAGGED note, a start chance below 70%, or very few season starts. Do not wait to be challenged on it. "Welbeck, though he is a doubt at 75%" is the standard, not "Welbeck" alone.
- The brief DOES carry injury and team news, in the FLAGGED field, and season starts and minutes for every player named. Never say you have no injury or team news on someone who appears in the brief — read their line. Only say you lack information about a player who is not in the brief at all.
- If the manager tells you something you cannot see — that a player is out, or was benched last week — believe them over the projection, say so plainly, and adjust the advice. Our numbers are computed before team sheets are published, so a manager watching the news often knows more than we do.
- When a manager says a player is injured and your brief shows no flag, do not simply contradict them. FPL adds and removes flags through the day, so the likeliest explanation is that the flag was lifted, or added, since this page loaded. Say when the team news was read, and tell them to refresh rather than implying they are mistaken.
- A start percentage already accounts for any injury flag. Never quote a high start percentage as evidence a player is fit — if the flag was lifted five minutes ago the percentage has not caught up in the manager's mind, and if it was added five minutes ago your number is the stale one.
- If asked something the brief does not cover — a rumour, a manager's press conference, next season — say you do not have that, and answer what you can from what you do have.
- Never claim certainty about who will start or score. These are projections.
- No headings, no bullet lists unless comparing three or more things. Plain sentences.`;
