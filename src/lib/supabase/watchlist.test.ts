import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addToWatchlist, listWatchlist, removeFromWatchlist } from "./watchlist";

/** Records every call made on the query builder. */
function fake(result: { data?: unknown; error?: { message: string } | null }) {
  const calls: [string, unknown[]][] = [];
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "order", "limit", "upsert", "delete", "eq"]) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, args]);
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null, ...result });
  const client = { from: (t: string) => (calls.push(["from", [t]]), builder) } as unknown as SupabaseClient;
  return { client, calls };
}

describe("watchlist store", () => {
  it("lists element ids, newest first", async () => {
    const { client, calls } = fake({ data: [{ element_id: 3 }, { element_id: 1 }] });
    expect(await listWatchlist(client)).toEqual([3, 1]);
    expect(calls).toContainEqual(["order", ["created_at", { ascending: false }]]);
  });

  it("lists nothing on an error, such as the table not existing yet", async () => {
    const { client } = fake({ error: { message: 'relation "watchlist" does not exist' } });
    expect(await listWatchlist(client)).toEqual([]);
  });

  it("upserts, so starring twice is harmless", async () => {
    const { client, calls } = fake({});
    expect(await addToWatchlist(client, "u1", 12)).toBeNull();
    expect(calls).toContainEqual([
      "upsert",
      [{ user_id: "u1", element_id: 12 }, { onConflict: "user_id,element_id" }],
    ]);
  });

  it("deletes by element and reports errors", async () => {
    const { client, calls } = fake({ error: { message: "denied" } });
    expect(await removeFromWatchlist(client, 12)).toBe("denied");
    expect(calls).toContainEqual(["eq", ["element_id", 12]]);
  });
});
