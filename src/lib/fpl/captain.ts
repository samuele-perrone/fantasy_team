import type { PlayerRow } from "./row";
import type { PlayerVerdict } from "./verdict";

/**
 * Who to captain next gameweek: the squad player with the most expected points in it, and the
 * next one as vice-captain.
 *
 * `xPtsNext` is the whole gameweek, so a double gameweek counts both games and a blank counts
 * none, and it already carries the chance of starting and any injury news. The highest scorer
 * is always in the best XI whatever the formation, so no XI has to be picked first.
 */

/**
 * The model's typical error is ~1.6 points per player per gameweek (docs/MODEL.md). A gap
 * under a point between captain and vice is well inside that, so it is called a close call
 * rather than presented as a clear pick.
 */
export const CLOSE_CALL = 1;

export interface CaptainPick {
  playerId: number;
  /** expected points next gameweek, before the captain's doubling */
  points: number;
  reason: string;
  viceId: number | null;
  vicePoints: number | null;
  /** captain and vice are within the model's error of each other */
  close: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function gameweekFixtures(p: PlayerRow, event: number): string {
  return p.fixtures
    .filter((f) => f.event === event)
    .map((f) => `${f.opponent} (${f.isHome ? "h" : "a"})`)
    .join(", ");
}

export function pickCaptain(verdicts: PlayerVerdict[], nextEvent: number): CaptainPick | null {
  // A Sell is advice to transfer the player out, so they are not offered as captain too. Unless
  // that leaves nobody, which only a squad of fifteen sells could.
  const keepers = verdicts.filter((v) => v.verdict !== "sell");
  const ranked = (keepers.length ? keepers : verdicts)
    .map((v) => v.player)
    .filter((p) => p.xPtsNext > 0)
    .sort((a, b) => b.xPtsNext - a.xPtsNext);
  const [captain, vice] = ranked;
  if (!captain) return null;

  const games = captain.fixtures.filter((f) => f.event === nextEvent).length;
  const close = vice !== undefined && captain.xPtsNext - vice.xPtsNext < CLOSE_CALL;
  const against = gameweekFixtures(captain, nextEvent);
  const reason = close
    ? `Close call with ${vice.name}, either is a fair pick`
    : games > 1
      ? `Two games: ${against}`
      : `Most points expected in your squad, v ${against}`;

  return {
    playerId: captain.id,
    points: round1(captain.xPtsNext),
    reason,
    viceId: vice?.id ?? null,
    vicePoints: vice ? round1(vice.xPtsNext) : null,
    close,
  };
}
