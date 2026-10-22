import type { FplFixture } from "./types";

/**
 * Matches a Premier League club plays outside the Premier League — Champions League, Europa
 * League, Conference League, FA Cup and EFL Cup — and the fixture congestion they cause. FPL
 * only lists league fixtures, so these come from ESPN (src/lib/football/client.ts).
 */

export interface OtherMatch {
  id: number;
  /** FPL team id of the Premier League club */
  teamId: number;
  kickoff: string;
  competition: string;
  opponent: string;
  home: boolean;
}

/** "Three games in seven days": three matches whose first and last fall within this span. */
export const CONGESTION = { games: 3, days: 7 } as const;

/**
 * One formatter, reused. `toLocaleDateString` with a time zone builds a new formatter on every
 * call, and checking ~380 fixtures against every kickoff of their clubs made that 550 ms of
 * every request — almost all of a page's server time.
 */
const LONDON = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayCache = new Map<string, number>();

/** Calendar day in London, as a day count, so a 20:00 kickoff and a 12:30 one compare by date. */
function londonDay(iso: string): number {
  let day = dayCache.get(iso);
  if (day === undefined) {
    const [d, m, y] = LONDON.format(new Date(iso)).split("/").map(Number);
    day = Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
    dayCache.set(iso, day);
  }
  return day;
}

/**
 * Whether a match sits in a run of three games in seven days, counting every competition.
 * The run can fall either side of it: a league game straight after a midweek European tie
 * is congested, and so is the one before it.
 */
export function isCongested(kickoff: string, allKickoffs: string[]): boolean {
  const day = londonDay(kickoff);
  const days = allKickoffs.map(londonDay);
  for (let start = day - CONGESTION.days; start <= day; start++) {
    const inWindow = days.filter((d) => d >= start && d <= start + CONGESTION.days).length;
    if (inWindow >= CONGESTION.games) return true;
  }
  return false;
}

export interface TeamSchedule {
  /** non-league matches still to be played, soonest first */
  others: OtherMatch[];
  /** ids of this club's league fixtures that fall in a congested run */
  congested: Set<number>;
}

/** Per club: its other matches, and which of its league fixtures they make congested. */
export function buildSchedules(
  fixtures: FplFixture[],
  others: OtherMatch[],
  now = Date.now(),
): Map<number, TeamSchedule> {
  const byTeam = new Map<number, TeamSchedule>();
  const league = new Map<number, FplFixture[]>();
  for (const f of fixtures) {
    if (!f.kickoff_time) continue;
    for (const t of [f.team_h, f.team_a]) league.set(t, [...(league.get(t) ?? []), f]);
  }

  for (const [teamId, list] of league) {
    const extra = others.filter((o) => o.teamId === teamId);
    const kickoffs = [...list.map((f) => f.kickoff_time!), ...extra.map((o) => o.kickoff)];
    // League-only runs count too: the Christmas schedule and a double gameweek beside a normal
    // one rotate squads just as a European tie does.
    const congested = new Set(
      list.filter((f) => isCongested(f.kickoff_time!, kickoffs)).map((f) => f.id),
    );
    byTeam.set(teamId, {
      others: extra
        .filter((o) => Date.parse(o.kickoff) > now - 3 * 3_600_000)
        .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff)),
      congested,
    });
  }
  return byTeam;
}
