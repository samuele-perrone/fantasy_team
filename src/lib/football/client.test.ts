import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));

import { team } from "@/test/factories";
import { COMPETITIONS, getOtherMatches, seasonYears } from "./client";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const plTeams = {
  sports: [{ leagues: [{ teams: [{ team: { id: "359", displayName: "Arsenal", shortDisplayName: "Arsenal", abbreviation: "ARS", logos: [] } }] }] }],
};
const event = (id: string, date: string, home = "5", away = "359") => ({
  id,
  date,
  status: { type: { name: "STATUS_SCHEDULED" } },
  competitions: [
    {
      competitors: [
        { homeAway: "home", team: { id: home, displayName: home === "359" ? "Arsenal" : "Bayern Munich" } },
        { homeAway: "away", team: { id: away, displayName: away === "359" ? "Arsenal" : "Bayern Munich" } },
      ],
    },
  ],
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  fetchMock.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const fpl = [team(1, { name: "Arsenal", short_name: "ARS" })];

describe("seasonYears", () => {
  it("spans August to May", () => {
    expect(seasonYears(new Date("2026-10-22T00:00:00Z"))).toEqual([2026, 2027]);
    expect(seasonYears(new Date("2027-03-01T00:00:00Z"))).toEqual([2026, 2027]);
    expect(seasonYears(new Date("2027-07-01T00:00:00Z"))).toEqual([2027, 2028]);
  });
});

describe("getOtherMatches", () => {
  it("reads every competition for both years of the season and maps onto FPL clubs", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/eng.1/teams")) return json(plTeams);
      if (url.includes("/uefa.champions/") && url.includes("dates=2026")) {
        return json({
          events: [
            event("1", "2026-11-04T20:00Z"),
            // last season's final sits in the same calendar year and must be left out
            event("2", "2026-05-30T19:00Z"),
          ],
        });
      }
      return json({ events: [] });
    });

    expect(await getOtherMatches(fpl)).toEqual([
      { id: 1, teamId: 1, kickoff: "2026-11-04T20:00Z", competition: "Champions League", opponent: "Bayern Munich", home: false },
    ]);
    // the club list, then two years for each competition
    expect(fetchMock).toHaveBeenCalledTimes(1 + COMPETITIONS.length * 2);
  });

  it("degrades to nothing when ESPN fails, rather than breaking every page", async () => {
    fetchMock.mockResolvedValue(json({}, 503));
    expect(await getOtherMatches(fpl)).toEqual([]);
  });

  it("degrades to nothing when ESPN changes its format", async () => {
    fetchMock.mockResolvedValue(json({ unexpected: true }));
    expect(await getOtherMatches(fpl)).toEqual([]);
  });
});
