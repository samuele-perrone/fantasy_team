import "server-only";
import { getGameData, getPlayerRows } from "@/lib/fpl/data";
import { pickCaptain, type CaptainPick } from "@/lib/fpl/captain";
import { planWildcard, type WildcardPlan } from "@/lib/fpl/wildcard";
import { loadTeam, type LoadedTeam } from "@/lib/fpl/entry";
import type { PlayerRow } from "@/lib/fpl/row";
import { foldName } from "@/lib/utils";
import {
  bestSwapFor,
  computeVerdicts,
  suggestTransfers,
  VERDICT_RULES,
  type PlayerVerdict,
  type Suggestion,
  type VerdictInput,
} from "@/lib/fpl/verdict";

/**
 * Everything the app shows, assembled once on the server.
 *
 * Pages and the `/api/v1` routes both call these functions, so the web app and the iOS app
 * that follows read the same conclusions — and so does the AI panel, through the brief.
 */

export interface SquadSummary {
  entryId: number;
  name: string;
  managerName: string | null;
  /** gameweek the picks were read from */
  event: number;
  /** gameweek the verdicts are about */
  nextEvent: number;
  deadline: string | null;
  bank: number;
  freeTransfers: number;
}

export interface SquadView {
  team: SquadSummary;
  verdicts: PlayerVerdict[];
  suggestions: Suggestion[];
  /** who to captain next gameweek; null when nobody in the squad has a game */
  captain: CaptainPick | null;
}

const ORDER = { sell: 0, watch: 1, keep: 2 } as const;

function verdictInput(team: LoadedTeam, nextEvent: number): VerdictInput {
  return {
    squad: team.squad,
    pool: team.pool,
    bank: team.bank,
    freeTransfers: team.freeTransfers,
    nextEvent,
    rules: team.rules,
  };
}

/** Verdicts for an already loaded team, in the order the page lists them. */
export async function verdictsFor(team: LoadedTeam): Promise<PlayerVerdict[]> {
  const data = await getGameData();
  return computeVerdicts(verdictInput(team, data.ctx.nextEvent)).sort(
    (a, b) => ORDER[a.verdict] - ORDER[b.verdict] || a.player.posId - b.player.posId,
  );
}

export async function getSquadView(entryId: number): Promise<SquadView> {
  const [team, data] = await Promise.all([
    loadTeam(entryId, VERDICT_RULES.horizon),
    getGameData(),
  ]);
  const input = verdictInput(team, data.ctx.nextEvent);
  const next = data.events.find((e) => e.id === data.ctx.nextEvent) ?? null;

  const verdicts = await verdictsFor(team);

  return {
    team: {
      entryId,
      name: team.name,
      managerName: team.managerName,
      event: team.event,
      nextEvent: data.ctx.nextEvent,
      deadline: next?.deadline_time ?? null,
      bank: team.bank,
      freeTransfers: team.freeTransfers,
    },
    verdicts,
    suggestions: suggestTransfers(input),
    captain: pickCaptain(verdicts, data.ctx.nextEvent),
  };
}

export interface WildcardView extends WildcardPlan {
  /** the gameweek the XI is set for */
  nextEvent: number;
}

/** The best squad a wildcard could buy with this team's money, against keeping it. */
export async function getWildcardView(entryId: number): Promise<WildcardView> {
  const [team, data] = await Promise.all([
    loadTeam(entryId, VERDICT_RULES.horizon),
    getGameData(),
  ]);
  return {
    ...planWildcard({ squad: team.squad, pool: team.pool, bank: team.bank, rules: team.rules }),
    nextEvent: data.ctx.nextEvent,
  };
}

export interface WatchedPlayer {
  player: PlayerRow;
  /** who they would replace in the manager's squad, when one is loaded and it is affordable */
  swap: { replaces: PlayerRow; gain: number } | null;
}

/** Watched players, each set against the squad player they would best replace. */
export async function getWatchedPlayers(
  ids: number[],
  entryId: number | null,
): Promise<WatchedPlayer[]> {
  if (!ids.length) return [];
  const [rows, data] = await Promise.all([
    getPlayerRows(VERDICT_RULES.horizon),
    getGameData(),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const team = entryId ? await loadTeam(entryId, VERDICT_RULES.horizon).catch(() => null) : null;
  const input = team ? verdictInput(team, data.ctx.nextEvent) : null;

  return ids
    .map((id) => byId.get(id))
    .filter((p): p is PlayerRow => Boolean(p))
    .map((player) => ({
      player,
      swap:
        input && !team!.squad.some((s) => s.id === player.id) ? bestSwapFor(player, input) : null,
    }));
}

/** Players matching a name search, for adding to the watchlist. */
export async function searchPlayers(query: string, limit = 12): Promise<PlayerRow[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const needle = foldName(q);
  const rows = await getPlayerRows(VERDICT_RULES.horizon);
  return rows
    .filter((r) => foldName(r.name).includes(needle) || foldName(r.fullName).includes(needle))
    .sort((a, b) => b.xPts - a.xPts)
    .slice(0, limit);
}
