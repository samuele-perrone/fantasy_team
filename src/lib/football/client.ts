import "server-only";
import { unstable_cache } from "next/cache";
import type { FplTeam } from "@/lib/fpl/types";
import type { OtherMatch } from "@/lib/fpl/schedule";
import { mapClubs, toOtherMatches, type EspnMatch, type EspnTeam } from "./clubs";

/**
 * European and cup fixtures for Premier League clubs, from ESPN's public site API.
 *
 * It is undocumented and unofficial: it needs no key and covers all five competitions for the
 * current season, which no free official API does (docs/DECISIONS.md). Only fixture dates and
 * opponents are read. It can change without notice, so every failure degrades to an empty
 * list and the app carries on without the congestion signal.
 */
const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

export const COMPETITIONS = [
  { slug: "uefa.champions", name: "Champions League" },
  { slug: "uefa.europa", name: "Europa League" },
  { slug: "uefa.europa.conf", name: "Conference League" },
  { slug: "eng.fa", name: "FA Cup" },
  { slug: "eng.league_cup", name: "EFL Cup" },
] as const;

async function espn<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
    // unstable_cache below stores the trimmed result; the raw responses are not worth caching.
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${path}`);
  return (await res.json()) as T;
}

interface RawEvent {
  id: string;
  date: string;
  status?: { type?: { name?: string } };
  competitions?: {
    competitors?: { homeAway: string; team: { id: string; displayName: string } }[];
  }[];
}

function trim(e: RawEvent): EspnMatch | null {
  const sides = e.competitions?.[0]?.competitors ?? [];
  const home = sides.find((s) => s.homeAway === "home")?.team;
  const away = sides.find((s) => s.homeAway === "away")?.team;
  if (!home || !away) return null;
  return {
    id: e.id,
    date: e.date,
    status: e.status?.type?.name ?? "",
    home: { id: home.id, name: home.displayName },
    away: { id: away.id, name: away.displayName },
  };
}

/** The two calendar years an English season spans: August 2026 to May 2027 is 2026 and 2027. */
export function seasonYears(now = new Date()): [number, number] {
  const y = now.getUTCFullYear();
  return now.getUTCMonth() >= 6 ? [y, y + 1] : [y - 1, y];
}

/**
 * Raw feed, refreshed every six hours. A scoreboard request with `dates=<year>` returns that
 * calendar year of one competition, so a season is two per competition plus one for the
 * Premier League's clubs: eleven requests, four times a day.
 */
const getFeed = unstable_cache(
  async () => {
    const [start, end] = seasonYears();
    const from = Date.UTC(start, 6, 1);
    const to = Date.UTC(end, 6, 1);

    const teams = await espn<{
      sports: { leagues: { teams: { team: EspnTeam }[] }[] }[];
    }>("/eng.1/teams");

    const competitions = await Promise.all(
      COMPETITIONS.map(async (c) => {
        const years = await Promise.all(
          [start, end].map((y) =>
            espn<{ events?: RawEvent[] }>(`/${c.slug}/scoreboard?dates=${y}&limit=1000`),
          ),
        );
        const matches = years
          .flatMap((y) => y.events ?? [])
          .map(trim)
          .filter((m): m is EspnMatch => m !== null)
          // A calendar year holds the end of last season too.
          .filter((m) => Date.parse(m.date) >= from && Date.parse(m.date) < to);
        return { name: c.name, matches };
      }),
    );

    return {
      teams: teams.sports[0].leagues[0].teams.map(({ team: t }) => ({
        id: t.id,
        displayName: t.displayName,
        shortDisplayName: t.shortDisplayName,
        abbreviation: t.abbreviation,
      })),
      competitions,
    };
  },
  ["espn-fixtures-v1"],
  { revalidate: 21_600, tags: ["espn"] },
);

/** Every non-league match a Premier League club plays this season, or nothing if ESPN fails. */
export async function getOtherMatches(fplTeams: FplTeam[]): Promise<OtherMatch[]> {
  try {
    const feed = await getFeed();
    const clubs = mapClubs(feed.teams, fplTeams);
    return feed.competitions.flatMap((c) => toOtherMatches(c.matches, clubs, c.name));
  } catch (e) {
    console.error("[espn]", e);
    return [];
  }
}
