import type { FplTeam } from "@/lib/fpl/types";
import type { OtherMatch } from "@/lib/fpl/schedule";

/** A club as ESPN describes it. Ids are the same in every competition. */
export interface EspnTeam {
  id: string;
  displayName: string;
  shortDisplayName: string | null;
  abbreviation: string | null;
}

/** One match from an ESPN scoreboard, trimmed to what the schedule needs. */
export interface EspnMatch {
  id: string;
  date: string;
  /** ESPN's status name, e.g. STATUS_SCHEDULED, STATUS_FULL_TIME, STATUS_POSTPONED */
  status: string;
  home: { id: string; name: string };
  away: { id: string; name: string };
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\b(a?fc|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** FPL's abbreviated names, spelled out as ESPN writes them. */
const ALIASES: Record<string, string> = {
  "man city": "manchester city",
  "man utd": "manchester united",
  spurs: "tottenham hotspur",
  "nottm forest": "nottingham forest",
  wolves: "wolverhampton wanderers",
  newcastle: "newcastle united",
  "west ham": "west ham united",
  brighton: "brighton hove albion",
  leeds: "leeds united",
  leicester: "leicester city",
  ipswich: "ipswich town",
  "sheffield utd": "sheffield united",
  luton: "luton town",
  norwich: "norwich city",
  coventry: "coventry city",
  hull: "hull city",
  stoke: "stoke city",
  swansea: "swansea city",
  cardiff: "cardiff city",
  "west brom": "west bromwich albion",
  qpr: "queens park rangers",
};

/**
 * ESPN team id → FPL team id, for the Premier League clubs only.
 *
 * Built from ESPN's own Premier League team list, so a foreign club can never be mistaken for
 * an English one — Brest and Brentford share the abbreviation BRE, and both have been in the
 * Champions League. Within those twenty, names are compared after folding case, accents and
 * "FC", with FPL's abbreviations spelled out; the abbreviation is the last resort.
 */
export function mapClubs(espnTeams: EspnTeam[], fplTeams: FplTeam[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of fplTeams) {
    const name = fold(t.name);
    const wanted = new Set([name, ALIASES[name] ?? name]);
    const free = espnTeams.filter((e) => !out.has(e.id));
    const match =
      free.find((e) => wanted.has(fold(e.displayName))) ??
      free.find((e) => e.shortDisplayName && wanted.has(fold(e.shortDisplayName))) ??
      free.find((e) => e.abbreviation === t.short_name);
    if (match) out.set(match.id, t.id);
  }
  return out;
}

/** Matches that will not be played on the listed date. A postponed tie is re-listed once rearranged. */
const DEAD = new Set(["STATUS_CANCELED", "STATUS_POSTPONED", "STATUS_ABANDONED", "STATUS_FORFEIT"]);

/** A competition's matches, kept only where a Premier League club is playing. */
export function toOtherMatches(
  matches: EspnMatch[],
  clubs: Map<string, number>,
  competition: string,
): OtherMatch[] {
  const out: OtherMatch[] = [];
  for (const m of matches) {
    if (DEAD.has(m.status)) continue;
    for (const [side, other, home] of [
      [m.home, m.away, true],
      [m.away, m.home, false],
    ] as const) {
      const teamId = clubs.get(side.id);
      if (teamId === undefined) continue;
      out.push({
        id: Number(m.id),
        teamId,
        kickoff: m.date,
        competition,
        opponent: other.name,
        home,
      });
    }
  }
  return out;
}
