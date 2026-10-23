import { beforeEach, describe, expect, it, vi } from "vitest";

const user = vi.hoisted(() => ({ id: "u1" as string | null }));
const store = vi.hoisted(() => ({ addToWatchlist: vi.fn(), removeFromWatchlist: vi.fn() }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ getUserId: async () => user.id, createClient: async () => "sb" }));
vi.mock("@/lib/supabase/watchlist", () => store);
const teams = vi.hoisted(() => ({ switchTeam: vi.fn(async () => {}), removeTeam: vi.fn(async () => ({})) }));
vi.mock("next/cache", () => cache);
vi.mock("@/lib/supabase/teams", () => teams);

import { forgetTeam, selectTeam, setWatched } from "./actions";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

beforeEach(() => {
  user.id = "u1";
  vi.clearAllMocks();
});

describe("setWatched", () => {
  it("stars and unstars, then refreshes the pages that show stars", async () => {
    await setWatched(form({ playerId: "12", watch: "1" }));
    expect(store.addToWatchlist).toHaveBeenCalledWith("sb", "u1", 12);
    await setWatched(form({ playerId: "12", watch: "0" }));
    expect(store.removeFromWatchlist).toHaveBeenCalledWith("sb", 12);
    expect(cache.revalidatePath).toHaveBeenCalledWith("/watchlist");
    expect(cache.revalidatePath).toHaveBeenCalledWith("/players");
    expect(cache.revalidatePath).toHaveBeenCalledWith("/players/12");
  });

  it("does nothing signed out or with a bad id", async () => {
    user.id = null;
    await setWatched(form({ playerId: "12", watch: "1" }));
    user.id = "u1";
    await setWatched(form({ playerId: "abc", watch: "1" }));
    await setWatched(form({ playerId: "0", watch: "1" }));
    expect(store.addToWatchlist).not.toHaveBeenCalled();
  });
});

describe("selectTeam and forgetTeam", () => {
  it("switch to and forget a team for the signed-in user, then refresh My Squad", async () => {
    await selectTeam(form({ entryId: "22" }));
    expect(teams.switchTeam).toHaveBeenCalledWith("sb", "u1", 22);
    await forgetTeam(form({ entryId: "33" }));
    expect(teams.removeTeam).toHaveBeenCalledWith("sb", "u1", 33);
    expect(cache.revalidatePath).toHaveBeenCalledWith("/squad");
  });

  it("do nothing signed out or with a malformed id", async () => {
    await selectTeam(form({ entryId: "abc" }));
    user.id = null;
    await forgetTeam(form({ entryId: "33" }));
    expect(teams.switchTeam).not.toHaveBeenCalled();
    expect(teams.removeTeam).not.toHaveBeenCalled();
  });

  it("a team that is not saved leaves the page as it was rather than failing", async () => {
    teams.switchTeam.mockRejectedValueOnce(new Error("not saved"));
    await expect(selectTeam(form({ entryId: "99" }))).resolves.toBeUndefined();
  });
});

