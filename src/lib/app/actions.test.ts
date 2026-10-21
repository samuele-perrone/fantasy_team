import { beforeEach, describe, expect, it, vi } from "vitest";

const user = vi.hoisted(() => ({ id: "u1" as string | null }));
const store = vi.hoisted(() => ({ addToWatchlist: vi.fn(), removeFromWatchlist: vi.fn() }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ getUserId: async () => user.id, createClient: async () => "sb" }));
vi.mock("@/lib/supabase/watchlist", () => store);
vi.mock("next/cache", () => cache);

import { setWatched } from "./actions";

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
