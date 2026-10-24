/**
 * What happened since the last look: compares two snapshots of the Matches data and returns
 * the goals, own goals, red cards and full-time whistles that are new.
 *
 * Plain TypeScript with no Deno or Node APIs, so the edge function imports it and Vitest tests
 * it. The input is `/api/v1/matches`, the same JSON the app reads.
 */

export interface Incident {
  playerId: number;
  name: string;
  side: "h" | "a";
  value: number;
}

export interface MatchSide {
  id: number;
  name: string;
  short: string;
  score: number | null;
}

export interface Match {
  id: number;
  status: "upcoming" | "live" | "finished" | "postponed";
  home: MatchSide;
  away: MatchSide;
  goals: Incident[];
  assists: Incident[];
  ownGoals: Incident[];
  redCards: Incident[];
  players: { id: number; mine: boolean }[];
}

export interface Matchday {
  event: number;
  live: boolean;
  days: { matches: Match[] }[];
}

/** Per match, what has happened so far: counts by player, and whether it has finished. */
export interface Snapshot {
  event: number;
  matches: Record<
    string,
    {
      finished: boolean;
      goals: Record<string, number>;
      assists: Record<string, number>;
      ownGoals: Record<string, number>;
      redCards: Record<string, number>;
    }
  >;
}

export type LiveEvent =
  | {
      kind: "goal";
      matchId: number;
      playerId: number;
      name: string;
      club: string;
      assist: string | null;
      score: string;
    }
  | { kind: "ownGoal"; matchId: number; playerId: number; name: string; club: string; score: string }
  | { kind: "redCard"; matchId: number; playerId: number; name: string; club: string; score: string }
  | { kind: "fullTime"; matchId: number; score: string };

const counts = (list: Incident[]) =>
  Object.fromEntries(list.map((i) => [String(i.playerId), i.value]));

export const allMatches = (day: Matchday) => day.days.flatMap((d) => d.matches);

export function snapshot(day: Matchday): Snapshot {
  return {
    event: day.event,
    matches: Object.fromEntries(
      allMatches(day).map((m) => [
        String(m.id),
        {
          finished: m.status === "finished",
          goals: counts(m.goals),
          assists: counts(m.assists),
          ownGoals: counts(m.ownGoals),
          redCards: counts(m.redCards),
        },
      ]),
    ),
  };
}

export const scoreline = (m: Match) =>
  `${m.home.name} ${m.home.score ?? 0}–${m.away.score ?? 0} ${m.away.name}`;

/** Players whose count went up, once per extra goal or card. */
function increases(now: Incident[], before: Record<string, number>): Incident[] {
  return now.flatMap((i) => {
    const extra = i.value - (before[String(i.playerId)] ?? 0);
    return extra > 0 ? Array.from({ length: extra }, () => i) : [];
  });
}

/**
 * New events between `prev` and the current Matches data. Nothing is reported without a
 * previous snapshot of the same gameweek, nor for a match the previous snapshot did not have:
 * the first look only sets the baseline, so switching it on, or a new gameweek, never sends a
 * burst of old goals.
 */
export function newEvents(prev: Snapshot | null, day: Matchday): LiveEvent[] {
  if (!prev || prev.event !== day.event) return [];
  const events: LiveEvent[] = [];
  for (const m of allMatches(day)) {
    const before = prev.matches[String(m.id)];
    if (!before) continue;
    const club = (side: "h" | "a") => (side === "h" ? m.home : m.away).name;
    const score = scoreline(m);

    // FPL records the assist with the goal, so a goal and an assist that appear in the same
    // look are paired up; with several goals at once the pairing is by club, best effort.
    const newAssists = increases(m.assists, before.assists ?? {});
    for (const g of increases(m.goals, before.goals)) {
      const i = newAssists.findIndex((a) => a.side === g.side);
      const assist = i >= 0 ? newAssists.splice(i, 1)[0].name : null;
      events.push({
        kind: "goal",
        matchId: m.id,
        playerId: g.playerId,
        name: g.name,
        club: club(g.side),
        assist,
        score,
      });
    }
    for (const o of increases(m.ownGoals, before.ownGoals)) {
      events.push({ kind: "ownGoal", matchId: m.id, playerId: o.playerId, name: o.name, club: club(o.side), score });
    }
    for (const r of increases(m.redCards, before.redCards)) {
      events.push({ kind: "redCard", matchId: m.id, playerId: r.playerId, name: r.name, club: club(r.side), score });
    }
    if (m.status === "finished" && !before.finished) {
      events.push({ kind: "fullTime", matchId: m.id, score });
    }
  }
  return events;
}


/** One phone's notification settings, as `push_devices` holds them. */
export interface DevicePrefs {
  scope: "mine" | "all";
  goals: boolean;
  redCards: boolean;
  fullTime: boolean;
}

/**
 * Whether a phone gets this event. "mine" means matches with a player from the phone's FPL
 * squad at either club: `myMatches` holds those match IDs, empty when no team is known.
 */
export function wants(prefs: DevicePrefs, e: LiveEvent, myMatches: Set<number>): boolean {
  if (prefs.scope === "mine" && !myMatches.has(e.matchId)) return false;
  if (e.kind === "goal" || e.kind === "ownGoal") return prefs.goals;
  if (e.kind === "redCard") return prefs.redCards;
  return prefs.fullTime;
}

/** The notification's words. A goal by a player in the phone's squad says so. */
export function message(e: LiveEvent, mySquad: Set<number>): { title: string; body: string } {
  switch (e.kind) {
    case "goal": {
      const yours = mySquad.has(e.playerId) ? " for you" : "";
      return {
        title: `⚽ ${e.name} scores${yours}`,
        body: e.assist ? `${e.score} · assist ${e.assist}` : e.score,
      };
    }
    case "ownGoal":
      return { title: `⚽ Own goal by ${e.name}`, body: e.score };
    case "redCard":
      return { title: `🟥 Red card: ${e.name} (${e.club})`, body: e.score };
    case "fullTime":
      return { title: "Full time", body: e.score };
  }
}
