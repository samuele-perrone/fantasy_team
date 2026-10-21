import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));

import { element } from "@/test/factories";
import { FplError, getBootstrap, getEntry } from "./client";

const fetchMock = vi.fn();
const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Run a request to completion, fast-forwarding through the retry backoff. */
async function settle<T>(p: Promise<T>): Promise<T> {
  const done = p.then(
    (v) => ({ ok: true as const, v }),
    (e) => ({ ok: false as const, e }),
  );
  await vi.runAllTimersAsync();
  const r = await done;
  if (!r.ok) throw r.e;
  return r.v;
}

describe("fplFetch", () => {
  it("sends a browser user agent, which FPL requires", async () => {
    fetchMock.mockResolvedValue(json(200, { id: 1 }));
    await settle(getEntry(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://fantasy.premierleague.com/api/entry/1/");
    expect(init.headers["User-Agent"]).toContain("Mozilla");
  });

  it("retries rate limiting and upstream errors, then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(json(429))
      .mockResolvedValueOnce(json(503))
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(json(200, { id: 7 }));
    expect(await settle(getEntry(7))).toEqual({ id: 7 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("gives up straight away on a 404", async () => {
    fetchMock.mockResolvedValue(json(404));
    await expect(settle(getEntry(9))).rejects.toMatchObject({ name: "FplError", status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after four attempts", async () => {
    fetchMock.mockResolvedValue(json(403));
    await expect(settle(getEntry(9))).rejects.toBeInstanceOf(FplError);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe("getBootstrap", () => {
  it("keeps only the fields the app reads, including when news was added", async () => {
    const raw = { ...element({ id: 5, news_added: "2026-10-19T10:00:00Z" }), photo: "x.jpg", ep_next: "4.0" };
    fetchMock.mockResolvedValue(
      json(200, {
        events: [],
        teams: [],
        total_players: 1,
        element_types: [{ id: 1, singular_name_short: "GKP", squad_select: 2, squad_min_play: 1, squad_max_play: 1, plural_name: "x" }],
        game_settings: { squad_squadsize: 15, squad_squadplay: 11, squad_team_limit: 3, squad_total_spend: 1000, transfers_sell_on_fee: 0.5, max_extra_free_transfers: 4, league_join_private_max: 30 },
        elements: [raw],
      }),
    );
    const bs = await settle(getBootstrap());
    expect(bs.elements[0]).not.toHaveProperty("photo");
    expect(bs.elements[0]).not.toHaveProperty("ep_next");
    expect(bs.elements[0].news_added).toBe("2026-10-19T10:00:00Z");
    expect(bs.element_types[0]).not.toHaveProperty("plural_name");
    expect(bs.game_settings).not.toHaveProperty("league_join_private_max");
  });
});
