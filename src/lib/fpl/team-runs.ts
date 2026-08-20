import "server-only";
import { getGameData } from "./data";
import { cleanSheetProbability, expectedGoals } from "./ratings";

export interface RunFixture {
  event: number;
  opponent: string;
  opponentId: number;
  isHome: boolean;
  difficulty: number;
  xGF: number;
  xGA: number;
  csProb: number;
  /** attack rating 1–5 where 1 is the easiest defence to score against */
  attackRating: number;
  /** defence rating 1–5 where 1 is the easiest attack to keep out */
  defenceRating: number;
}

export interface TeamRun {
  id: number;
  name: string;
  short: string;
  code: number;
  fixtures: RunFixture[];
  /** keyed by gameweek — a gameweek can hold zero (blank) or two (double) fixtures */
  byEvent: Record<number, RunFixture[]>;
  avgDifficulty: number;
  avgAttack: number;
  avgDefence: number;
  totalXGF: number;
  totalXGA: number;
  totalCs: number;
  matches: number;
}

/** Map a continuous 1–5ish score onto the integer FDR buckets used for colouring. */
function bucket(value: number, lo: number, hi: number): number {
  const t = (value - lo) / (hi - lo);
  if (t < 0.2) return 1;
  if (t < 0.4) return 2;
  if (t < 0.6) return 3;
  if (t < 0.8) return 4;
  return 5;
}

export async function getTeamRuns(fromEvent: number, horizon: number): Promise<TeamRun[]> {
  const { bootstrap, fixtures, ctx, teams } = await getGameData();
  const runs: TeamRun[] = [];

  for (const team of bootstrap.teams) {
    const rating = ctx.ratings.get(team.id)!;
    const relevant = fixtures.filter(
      (f) =>
        f.event !== null &&
        f.event >= fromEvent &&
        f.event < fromEvent + horizon &&
        (f.team_h === team.id || f.team_a === team.id),
    );

    const list: RunFixture[] = relevant
      .map((f) => {
        const isHome = f.team_h === team.id;
        const opponentId = isHome ? f.team_a : f.team_h;
        const opponent = ctx.ratings.get(opponentId)!;
        const xGF = expectedGoals(rating, opponent, isHome);
        const xGA = expectedGoals(opponent, rating, !isHome);
        return {
          event: f.event!,
          opponent: teams.get(opponentId)?.short_name ?? "?",
          opponentId,
          isHome,
          difficulty: isHome ? f.team_h_difficulty : f.team_a_difficulty,
          xGF,
          xGA,
          csProb: cleanSheetProbability(rating, opponent, isHome),
          attackRating: bucket(2.4 - xGF, 0.4, 1.9),
          defenceRating: bucket(xGA, 0.6, 2.4),
        };
      })
      .sort((a, b) => a.event - b.event);

    const byEvent: Record<number, RunFixture[]> = {};
    for (let e = fromEvent; e < fromEvent + horizon; e++) byEvent[e] = [];
    for (const f of list) byEvent[f.event]?.push(f);

    const matches = list.length || 1;
    runs.push({
      id: team.id,
      name: team.name,
      short: team.short_name,
      code: team.code,
      fixtures: list,
      byEvent,
      avgDifficulty: list.reduce((a, f) => a + f.difficulty, 0) / matches,
      avgAttack: list.reduce((a, f) => a + f.attackRating, 0) / matches,
      avgDefence: list.reduce((a, f) => a + f.defenceRating, 0) / matches,
      totalXGF: list.reduce((a, f) => a + f.xGF, 0),
      totalXGA: list.reduce((a, f) => a + f.xGA, 0),
      totalCs: list.reduce((a, f) => a + f.csProb, 0),
      matches: list.length,
    });
  }

  return runs;
}
