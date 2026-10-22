import { describe, expect, it } from "vitest";
import { team } from "@/test/factories";
import { mapClubs, toOtherMatches, type EspnMatch, type EspnTeam } from "./clubs";

const espn = (id: string, displayName: string, shortDisplayName: string, abbreviation: string): EspnTeam => ({
  id, displayName, shortDisplayName, abbreviation,
});

const fplTeams = [
  team(1, { name: "Man City", short_name: "MCI" }),
  team(2, { name: "Spurs", short_name: "TOT" }),
  team(3, { name: "Nott'm Forest", short_name: "NFO" }),
  team(4, { name: "Brighton", short_name: "BHA" }),
  team(5, { name: "Bournemouth", short_name: "BOU" }),
  team(6, { name: "Man Utd", short_name: "MUN" }),
  team(7, { name: "Brentford", short_name: "BRE" }),
];
// As ESPN's /eng.1/teams lists them, abbreviations included: MNC and MAN differ from FPL's.
const espnPremierLeague = [
  espn("382", "Manchester City", "Man City", "MNC"),
  espn("367", "Tottenham Hotspur", "Spurs", "TOT"),
  espn("393", "Nottingham Forest", "Nottm Forest", "NFO"),
  espn("331", "Brighton & Hove Albion", "Brighton", "BHA"),
  espn("349", "AFC Bournemouth", "Bournemouth", "BOU"),
  espn("360", "Manchester United", "Man United", "MAN"),
  espn("337", "Brentford", "Brentford", "BRE"),
];

describe("mapClubs", () => {
  const clubs = mapClubs(espnPremierLeague, fplTeams);

  it("matches FPL's abbreviated names to ESPN's full ones", () => {
    expect(Object.fromEntries(clubs)).toEqual({
      382: 1, 367: 2, 393: 3, 331: 4, 349: 5, 360: 6, 337: 7,
    });
  });

  it("never maps a club outside the Premier League list, even with the same code", () => {
    // Stade Brestois is BRE too, but it is not in the list mapping was built from
    expect(clubs.has("6997")).toBe(false);
  });

  it("falls back to the abbreviation for a name it cannot place", () => {
    const m = mapClubs([espn("1", "Some Renamed FC", "Renamed", "XYZ")], [team(9, { name: "Old Name", short_name: "XYZ" })]);
    expect(m.get("1")).toBe(9);
  });

  it("gives each ESPN club to one FPL club only", () => {
    const m = mapClubs([espn("1", "Hull City", "Hull", "HUL")], [
      team(1, { name: "Hull", short_name: "HUL" }),
      team(2, { name: "Hull City", short_name: "HUL" }),
    ]);
    expect([...m.values()]).toEqual([1]);
  });
});

describe("toOtherMatches", () => {
  const clubs = new Map([["382", 1], ["367", 2]]);
  const match = (partial: Partial<EspnMatch>): EspnMatch => ({
    id: "401",
    date: "2030-01-08T20:00Z",
    status: "STATUS_SCHEDULED",
    home: { id: "382", name: "Manchester City" },
    away: { id: "110", name: "Internazionale" },
    ...partial,
  });

  it("keeps the English club's side with its opponent and venue", () => {
    expect(toOtherMatches([match({})], clubs, "Champions League")).toEqual([
      { id: 401, teamId: 1, kickoff: "2030-01-08T20:00Z", competition: "Champions League", opponent: "Internazionale", home: true },
    ]);
  });

  it("lists an all-English tie once for each club", () => {
    const out = toOtherMatches([match({ away: { id: "367", name: "Tottenham Hotspur" } })], clubs, "CL");
    expect(out.map((o) => [o.teamId, o.home])).toEqual([[1, true], [2, false]]);
  });

  it("drops matches without an English club, and ones not being played on their date", () => {
    expect(toOtherMatches([match({ home: { id: "5", name: "Bayern" } })], clubs, "CL")).toEqual([]);
    for (const status of ["STATUS_POSTPONED", "STATUS_CANCELED"]) {
      expect(toOtherMatches([match({ status })], clubs, "CL")).toEqual([]);
    }
  });

  it("keeps finished matches, which still make the games around them congested", () => {
    expect(toOtherMatches([match({ status: "STATUS_FULL_TIME" })], clubs, "CL")).toHaveLength(1);
  });
});
