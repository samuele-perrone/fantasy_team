import type { FplFixture, FplTeam } from "./types";

export interface TeamRating {
  id: number;
  /** 1 (weak) – 5 (elite), derived from the difficulty opponents are given when facing this team at home */
  homeStrength: number;
  awayStrength: number;
  /** attacking / defensive quality on the same 1–5 scale */
  attack: number;
  defence: number;
  played: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 3);

/**
 * FPL zeroes out `strength_attack_*` / `strength_defence_*` in pre-season but always
 * publishes per-fixture difficulty ratings. The difficulty an opponent is handed for a
 * fixture *is* a rating of the other team, so we invert the fixture list to recover a
 * strength per team and fall back to the published strengths once they are populated.
 */
export function deriveTeamRatings(
  teams: FplTeam[],
  fixtures: FplFixture[],
): Map<number, TeamRating> {
  const homeFaced = new Map<number, number[]>();
  const awayFaced = new Map<number, number[]>();
  const played = new Map<number, number>();

  for (const t of teams) {
    homeFaced.set(t.id, []);
    awayFaced.set(t.id, []);
    played.set(t.id, 0);
  }

  for (const f of fixtures) {
    // difficulty handed to the away side rates the home side, and vice versa
    homeFaced.get(f.team_h)?.push(f.team_a_difficulty);
    awayFaced.get(f.team_a)?.push(f.team_h_difficulty);
    if (f.finished) {
      played.set(f.team_h, (played.get(f.team_h) ?? 0) + 1);
      played.set(f.team_a, (played.get(f.team_a) ?? 0) + 1);
    }
  }

  const ratings = new Map<number, TeamRating>();
  for (const t of teams) {
    const home = mean(homeFaced.get(t.id) ?? []);
    const away = mean(awayFaced.get(t.id) ?? []);

    // Published strengths are on a 1–5 scale too; blend them in when FPL has set them.
    const pubOverall =
      t.strength_overall_home && t.strength_overall_away
        ? (t.strength_overall_home + t.strength_overall_away) / 2
        : null;
    const pubAttack =
      t.strength_attack_home && t.strength_attack_away
        ? (t.strength_attack_home + t.strength_attack_away) / 2
        : null;
    const pubDefence =
      t.strength_defence_home && t.strength_defence_away
        ? (t.strength_defence_home + t.strength_defence_away) / 2
        : null;

    const overall = pubOverall ? (home + away) / 2 * 0.5 + pubOverall * 0.5 : (home + away) / 2;

    ratings.set(t.id, {
      id: t.id,
      homeStrength: home,
      awayStrength: away,
      attack: pubAttack ? (overall + pubAttack) / 2 : overall,
      defence: pubDefence ? (overall + pubDefence) / 2 : overall,
      played: played.get(t.id) ?? 0,
    });
  }
  return ratings;
}

const LEAGUE_AVG_GOALS = 1.42;
const HOME_ADVANTAGE = 1.11;
const AWAY_PENALTY = 0.9;

/** Convert a 1–5 rating into a multiplicative strength factor centred on 1.0 */
const factor = (rating: number, slope: number) => Math.exp(slope * (rating - 3) / 2);

/** Expected goals scored by `team` against `opponent`. */
export function expectedGoals(
  team: TeamRating,
  opponent: TeamRating,
  isHome: boolean,
): number {
  const venue = isHome ? HOME_ADVANTAGE : AWAY_PENALTY;
  return (
    LEAGUE_AVG_GOALS *
    factor(team.attack, 0.55) *
    factor(6 - opponent.defence, 0.55) *
    venue
  );
}

/** Probability the given team keeps a clean sheet in this fixture. */
export function cleanSheetProbability(
  team: TeamRating,
  opponent: TeamRating,
  isHome: boolean,
): number {
  const conceded = expectedGoals(opponent, team, !isHome);
  return Math.exp(-conceded);
}

/**
 * Multiplier applied to a player's baseline xG/xA per 90 for a specific fixture.
 * Neutral fixture = 1.0.
 */
export function attackingMultiplier(
  team: TeamRating,
  opponent: TeamRating,
  isHome: boolean,
): number {
  const xg = expectedGoals(team, opponent, isHome);
  return clamp(xg / LEAGUE_AVG_GOALS, 0.45, 2.1);
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Poisson P(X >= k) */
export function poissonAtLeast(lambda: number, k: number): number {
  if (lambda <= 0) return 0;
  let cumulative = 0;
  let term = Math.exp(-lambda);
  for (let i = 0; i < k; i++) {
    cumulative += term;
    term = (term * lambda) / (i + 1);
  }
  return clamp(1 - cumulative, 0, 1);
}
