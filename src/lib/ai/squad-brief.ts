import "server-only";
import type { LoadedTeam } from "@/lib/fpl/entry";
import type { PlayerRow } from "@/lib/fpl/row";
import { planTransfers } from "@/lib/fpl/optimiser";
import { chipStatuses } from "@/lib/fpl/chips";
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

export function buildSquadBrief(team: LoadedTeam): string {
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

  out.push(`GAMEWEEK ${team.event} is the one being picked.`);
  out.push(
    `Manager: ${team.managerName ?? "unknown"}. Team: ${team.name}. ` +
      `Squad value ${money(team.squadValue)}, ${money(team.bank)} in the bank, ` +
      `${team.freeTransfers} free transfer${team.freeTransfers === 1 ? "" : "s"}.`,
  );
  if (team.overallPoints !== null) {
    out.push(`Season so far: ${team.overallPoints} points, overall rank ${team.overallRank ?? "n/a"}.`);
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

How to answer:
- Talk about football, not models. Say "points", "minutes", "chance of starting", "how hard the fixture is". Never say xPts, xMins, xG, FDR, BPS, expected value, variance, or calibration.
- Be direct and short. Two or three sentences for a simple question. Lead with the answer, then one line of why.
- Use the numbers in the brief. They come from the same projections the rest of the site shows, so your answer must agree with what the manager can see on the page. Never invent a number, a fixture, an injury or a price.
- Do not accept a false premise in the question. If the manager asks "is it worth a -4 for X" but the brief shows that move costs no hit, correct them: say it is free and they are not paying 4 points. Check the hit figure in the brief before discussing any cost.
- A points hit costs 4 points for certain. Our per-player estimates are typically off by about 1.6 points a week, so if a plan's gain does not clearly beat the hit, say to hold. Do not talk anyone into a -4 for a marginal gain.
- Whenever you recommend signing a player, state their availability in the same breath if there is anything to flag: a FLAGGED note, a start chance below 70%, or very few season starts. Do not wait to be challenged on it. "Welbeck, though he is a doubt at 75%" is the standard, not "Welbeck" alone.
- The brief DOES carry injury and team news, in the FLAGGED field, and season starts and minutes for every player named. Never say you have no injury or team news on someone who appears in the brief — read their line. Only say you lack information about a player who is not in the brief at all.
- If the manager tells you something you cannot see — that a player is out, or was benched last week — believe them over the projection, say so plainly, and adjust the advice. Our numbers are computed before team sheets are published, so a manager watching the news often knows more than we do.
- If asked something the brief does not cover — a rumour, a manager's press conference, next season — say you do not have that, and answer what you can from what you do have.
- Never claim certainty about who will start or score. These are projections.
- No headings, no bullet lists unless comparing three or more things. Plain sentences.`;
