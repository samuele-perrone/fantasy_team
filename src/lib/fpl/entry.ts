import "server-only";
import { getEntry, getEntryHistory, getEntryPicks } from "./client";
import { getGameData, getPlayerRows } from "./data";
import type { PlayerRow } from "./row";
import { bestXI, SQUAD_QUOTA, TEAM_LIMIT, type XI } from "./optimiser";
import type { Entry, EntryPick, EntryPicks } from "./types";
import type { SquadRules } from "./rules";

export interface LoadedTeam {
  /** "fpl" when pulled from a real entry ID, "manual" when built by hand or imported */
  source: "fpl" | "manual";
  entryId: number | null;
  name: string;
  managerName: string | null;
  overallPoints: number | null;
  overallRank: number | null;
  event: number;
  picks: EntryPick[];
  activeChip: string | null;
  eventTransfersCost: number;
  squad: PlayerRow[];
  /** the model's optimal XI from these 15 */
  xi: XI;
  /** the XI as actually set — for manual squads this is the chosen starting 11 */
  actual: XI;
  captainId: number | null;
  viceCaptainId: number | null;
  bank: number;
  squadValue: number;
  freeTransfers: number;
  teamCodes: Record<number, number>;
  pool: PlayerRow[];
  /** squad rules as FPL currently publishes them */
  rules: SquadRules;
  history: Awaited<ReturnType<typeof getEntryHistory>> | null;
}

export class EntryNotFound extends Error {}
export class InvalidSquad extends Error {}

async function baseContext(horizon: number) {
  const [data, rows] = await Promise.all([getGameData(), getPlayerRows(horizon)]);
  const teamCodes: Record<number, number> = {};
  for (const t of data.bootstrap.teams) teamCodes[t.id] = t.code;
  return { data, rows, byId: new Map(rows.map((r) => [r.id, r])), teamCodes, rules: data.rules };
}

/** Build the XI/bench split described by an ordered pick list. */
function xiFromPicks(
  squad: PlayerRow[],
  picks: EntryPick[],
  captainId: number | null,
  viceCaptainId: number | null,
): XI {
  const byId = new Map(squad.map((p) => [p.id, p]));
  const ordered = [...picks].sort((a, b) => a.position - b.position);
  const starters = ordered
    .filter((p) => p.position <= 11)
    .map((p) => byId.get(p.element))
    .filter((p): p is PlayerRow => Boolean(p));
  const bench = ordered
    .filter((p) => p.position > 11)
    .map((p) => byId.get(p.element))
    .filter((p): p is PlayerRow => Boolean(p));

  return {
    starters,
    bench,
    captain: squad.find((p) => p.id === captainId) ?? null,
    viceCaptain: squad.find((p) => p.id === viceCaptainId) ?? null,
    formation: `${starters.filter((p) => p.posId === 2).length}-${starters.filter((p) => p.posId === 3).length}-${starters.filter((p) => p.posId === 4).length}`,
    startingPoints: starters.reduce((a, p) => a + p.xPtsNext, 0),
    benchPoints: bench.reduce((a, p) => a + p.xPtsNext, 0),
  };
}

export async function loadTeam(entryId: number, horizon = 5): Promise<LoadedTeam> {
  const { data, byId, rows, teamCodes, rules } = await baseContext(horizon);

  let entry: Entry;
  try {
    entry = await getEntry(entryId);
  } catch {
    throw new EntryNotFound(`No FPL squad found for ID ${entryId}`);
  }

  // Picks only exist for gameweeks that have started; before GW1 there is nothing to read.
  const candidateEvents = [
    entry.current_event,
    data.currentEvent?.id ?? null,
    (data.ctx.nextEvent ?? 1) - 1,
  ].filter((e): e is number => typeof e === "number" && e >= 1);

  let picks: EntryPicks | null = null;
  let event = 0;
  for (const candidate of candidateEvents) {
    try {
      picks = await getEntryPicks(entryId, candidate);
      event = candidate;
      break;
    } catch {
      continue;
    }
  }
  if (!picks) {
    throw new EntryNotFound(
      `Squad ${entryId} has no published picks yet — FPL only makes team sheets visible once the first deadline has passed.`,
    );
  }

  const history = await getEntryHistory(entryId).catch(() => null);

  const squad = picks.picks
    .map((p) => byId.get(p.element))
    .filter((p): p is PlayerRow => Boolean(p));

  const captain = picks.picks.find((p) => p.is_captain)?.element ?? null;
  const vice = picks.picks.find((p) => p.is_vice_captain)?.element ?? null;
  const last = history?.current?.[history.current.length - 1];

  return {
    source: "fpl",
    entryId,
    name: entry.name,
    managerName: `${entry.player_first_name} ${entry.player_last_name}`,
    overallPoints: entry.summary_overall_points,
    overallRank: entry.summary_overall_rank,
    event,
    picks: picks.picks,
    activeChip: picks.active_chip,
    eventTransfersCost: picks.entry_history?.event_transfers_cost ?? 0,
    squad,
    xi: bestXI(squad, "xPtsNext", undefined, rules),
    actual: xiFromPicks(squad, picks.picks, captain, vice),
    captainId: captain,
    viceCaptainId: vice,
    bank: (picks.entry_history?.bank ?? last?.bank ?? entry.last_deadline_bank ?? 0) / 10,
    squadValue:
      (picks.entry_history?.value ?? last?.value ?? entry.last_deadline_value ?? 1000) / 10,
    freeTransfers: estimateFreeTransfers(history?.current ?? []),
    teamCodes,
    pool: rows,
    rules,
    history,
  };
}

export interface ManualSquadInput {
  /** ordered player ids — first 11 start, last 4 are the bench */
  ids: number[];
  captainId?: number | null;
  viceCaptainId?: number | null;
  bank?: number;
  name?: string;
  freeTransfers?: number;
}

/** Validate a hand-built squad against the FPL squad rules. */
export function validateSquad(
  squad: PlayerRow[],
  bank = 0,
): { errors: string[]; warnings: string[]; cost: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cost = squad.reduce((a, p) => a + p.cost, 0);

  if (squad.length !== 15) errors.push(`A squad needs 15 players — you have ${squad.length}.`);

  const posNames: Record<number, string> = { 1: "goalkeepers", 2: "defenders", 3: "midfielders", 4: "forwards" };
  for (const [pos, quota] of Object.entries(SQUAD_QUOTA)) {
    const count = squad.filter((p) => p.posId === Number(pos)).length;
    if (count !== quota) {
      errors.push(`You need ${quota} ${posNames[Number(pos)]} — you have ${count}.`);
    }
  }

  const clubs = new Map<number, PlayerRow[]>();
  for (const p of squad) clubs.set(p.teamId, [...(clubs.get(p.teamId) ?? []), p]);
  for (const [, players] of clubs) {
    if (players.length > TEAM_LIMIT) {
      errors.push(
        `Maximum ${TEAM_LIMIT} players per club — you have ${players.length} from ${players[0].teamName}.`,
      );
    }
  }

  if (cost - bank > 100.0 + 1e-9) {
    warnings.push(
      `This squad costs £${cost.toFixed(1)}m at today's prices, which is over the £100.0m starting budget. That is normal for a squad built up over a season.`,
    );
  }

  const flagged = squad.filter((p) => p.status !== "a");
  if (flagged.length) {
    warnings.push(
      `${flagged.length} player${flagged.length > 1 ? "s are" : " is"} flagged: ${flagged.map((p) => p.name).join(", ")}.`,
    );
  }

  return { errors, warnings, cost: Math.round(cost * 10) / 10 };
}

/**
 * Build a LoadedTeam from a hand-entered squad so every analysis tool works identically
 * whether the squad came from the FPL API or was typed in.
 */
export async function loadManualTeam(
  input: ManualSquadInput,
  horizon = 5,
): Promise<LoadedTeam> {
  const { data, byId, rows, teamCodes, rules } = await baseContext(horizon);

  const seen = new Set<number>();
  const squad = input.ids
    .filter((id) => !seen.has(id) && (seen.add(id), true))
    .map((id) => byId.get(id))
    .filter((p): p is PlayerRow => Boolean(p));

  if (!squad.length) throw new InvalidSquad("No recognised players in that squad.");

  const { errors, cost } = validateSquad(squad, input.bank ?? 0);
  if (errors.length) throw new InvalidSquad(errors.join(" "));

  // The order the ids arrive in is the pick order: 1–11 start, 12–15 sit on the bench.
  const optimal = bestXI(squad, "xPtsNext", undefined, rules);
  const starterIds = new Set(
    squad.length === 15 && input.ids.length === 15
      ? squad.slice(0, 11).map((p) => p.id)
      : optimal.starters.map((p) => p.id),
  );

  const starters = squad.filter((p) => starterIds.has(p.id));
  const bench = squad.filter((p) => !starterIds.has(p.id));
  const ordered = [...starters, ...bench];

  const captainId =
    input.captainId && starterIds.has(input.captainId)
      ? input.captainId
      : (optimal.captain?.id ?? null);
  const viceCaptainId =
    input.viceCaptainId && starterIds.has(input.viceCaptainId) && input.viceCaptainId !== captainId
      ? input.viceCaptainId
      : (optimal.viceCaptain?.id ?? null);

  const picks: EntryPick[] = ordered.map((p, i) => ({
    element: p.id,
    position: i + 1,
    multiplier: i >= 11 ? 0 : p.id === captainId ? 2 : 1,
    is_captain: p.id === captainId,
    is_vice_captain: p.id === viceCaptainId,
  }));

  const event = data.currentEvent?.id ?? data.ctx.nextEvent;

  return {
    source: "manual",
    entryId: null,
    name: input.name?.trim() || "My squad",
    managerName: null,
    overallPoints: null,
    overallRank: null,
    event,
    picks,
    activeChip: null,
    eventTransfersCost: 0,
    squad,
    xi: optimal,
    actual: xiFromPicks(squad, picks, captainId, viceCaptainId),
    captainId,
    viceCaptainId,
    bank: input.bank ?? 0,
    squadValue: cost,
    freeTransfers: input.freeTransfers ?? 1,
    teamCodes,
    pool: rows,
    rules,
    history: null,
  };
}

export interface TeamQuery {
  id?: string | string[];
  squad?: string | string[];
  c?: string | string[];
  v?: string | string[];
  bank?: string | string[];
  name?: string | string[];
  ft?: string | string[];
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseSquadParam(value: string | undefined): number[] {
  return (value ?? "")
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0);
}

/**
 * Resolve whichever squad source the URL describes: a real FPL entry via `?id=`, or a
 * hand-built squad via `?squad=`. Returns null when neither is present.
 */
export async function resolveTeam(
  params: TeamQuery,
  horizon = 5,
): Promise<LoadedTeam | null> {
  const squadParam = first(params.squad);
  if (squadParam) {
    const ids = parseSquadParam(squadParam);
    if (ids.length) {
      return loadManualTeam(
        {
          ids,
          captainId: Number(first(params.c)) || null,
          viceCaptainId: Number(first(params.v)) || null,
          bank: Number(first(params.bank)) || 0,
          name: first(params.name),
          freeTransfers: Number(first(params.ft)) || 1,
        },
        horizon,
      );
    }
  }

  const idParam = first(params.id);
  const id = Number(idParam);
  if (idParam && Number.isFinite(id)) return loadTeam(id, horizon);

  return null;
}

/** Preserve whichever squad source the current page is using when linking between tools. */
export function teamQueryString(params: TeamQuery): string {
  const q = new URLSearchParams();
  for (const key of ["id", "squad", "c", "v", "bank", "name", "ft"] as const) {
    const value = first(params[key]);
    if (value) q.set(key, value);
  }
  return q.toString();
}

/**
 * FPL does not expose the free transfer count, so it is reconstructed from transfer history:
 * one earned per gameweek, rolling up to five.
 *
 * Gameweek one is skipped because transfers before the first deadline are unlimited and earn
 * no rollover — counting it handed everyone two free transfers for gameweek two instead of
 * the one they actually have.
 */
function estimateFreeTransfers(
  current: { event: number; event_transfers: number }[],
): number {
  if (!current.length) return 1;

  let free = 1;
  for (const gw of current.slice(1)) {
    free = Math.max(1, Math.min(5, free - gw.event_transfers + 1));
  }
  return free;
}
