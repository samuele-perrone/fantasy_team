/**
 * live-push: once a minute (pg_cron, migration 0009), looks for new goals, red cards and
 * full-time whistles and sends them to the phones that asked, through Apple Push.
 *
 * It reads the site's own /api/v1/matches, which serves FPL through a 60-second shared
 * cache, so however many phones are registered FPL sees no extra load. Runs as Supabase's
 * service role, which can read push_devices; the website never holds that key.
 *
 * Secrets (Supabase → Edge Functions → Secrets): APNS_KEY, the .p8 file's contents.
 * APNS_KEY_ID, APNS_TEAM_ID, APNS_TOPIC and SITE_URL have defaults below.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  allMatches,
  message,
  newEvents,
  snapshot,
  wants,
  type LiveEvent,
  type Matchday,
  type Snapshot,
} from "./events.ts";

const env = (name: string, fallback?: string) => Deno.env.get(name) ?? fallback ?? "";
const SITE = env("SITE_URL", "https://fantasyteamhub.com");
const TEAM_ID = env("APNS_TEAM_ID", "7RYYQ8M5X5");
const KEY_ID = env("APNS_KEY_ID", "5RK43T6R6V");
const TOPIC = env("APNS_TOPIC", "com.fantasyteamhub.app");
const APNS_HOST = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
};

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const b64url = (bytes: ArrayBuffer | Uint8Array | string) => {
  const raw = typeof bytes === "string" ? new TextEncoder().encode(bytes) : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** The provider token Apple wants on each request: an ES256 JWT, valid for up to an hour. */
async function apnsToken(): Promise<string> {
  const pem = env("APNS_KEY").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const head = b64url(JSON.stringify({ alg: "ES256", kid: KEY_ID }));
  const body = b64url(JSON.stringify({ iss: TEAM_ID, iat: Math.floor(Date.now() / 1000) }));
  // WebCrypto's ECDSA signature is already the raw r‖s form a JWT needs.
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(`${head}.${body}`),
  );
  return `${head}.${body}.${b64url(sig)}`;
}

async function fetchMatchday(query = ""): Promise<Matchday> {
  const res = await fetch(`${SITE}/api/v1/matches${query}`);
  if (!res.ok) throw new Error(`matches ${res.status}`);
  return await res.json();
}

interface Device {
  token: string;
  user_id: string | null;
  entry_id: number | null;
  environment: "sandbox" | "production";
  scope: "mine" | "all";
  goals: boolean;
  red_cards: boolean;
  full_time: boolean;
}

Deno.serve(async () => {
  // At most one run every 40 seconds, however often it is called: claim the slot atomically.
  const since = new Date(Date.now() - 40_000).toISOString();
  const { data: claimed } = await db
    .from("push_state")
    .update({ ran_at: new Date().toISOString() })
    .eq("id", 1)
    .or(`ran_at.is.null,ran_at.lt.${since}`)
    .select("snapshot");
  if (!claimed?.length) return Response.json({ skipped: "ran recently" });

  const day = await fetchMatchday();
  const prev = (claimed[0].snapshot as Snapshot | null) ?? null;
  const events = newEvents(prev, day);
  await db.from("push_state").update({ snapshot: snapshot(day) }).eq("id", 1);
  if (!events.length) return Response.json({ events: 0, live: day.live });

  const { data: rows } = await db
    .from("push_devices")
    .select("token,user_id,entry_id,environment,scope,goals,red_cards,full_time")
    .eq("enabled", true);
  const devices = (rows ?? []) as Device[];
  if (!devices.length) return Response.json({ events: events.length, devices: 0 });

  // Each phone's FPL team: the account's active team when signed in, else the phone's own.
  const userIds = [...new Set(devices.map((d) => d.user_id).filter((u): u is string => !!u))];
  const { data: profiles } = userIds.length
    ? await db.from("profiles").select("id,fpl_entry_id").in("id", userIds)
    : { data: [] };
  const profileEntry = new Map((profiles ?? []).map((p) => [p.id as string, p.fpl_entry_id as number | null]));
  const entryOf = (d: Device) => (d.user_id ? profileEntry.get(d.user_id) ?? null : d.entry_id);

  // Which matches involve each team's players, and who those players are: one look per team.
  const mine = new Map<number, { matches: Set<number>; squad: Set<number> }>();
  for (const entry of new Set(devices.map(entryOf).filter((e): e is number => !!e))) {
    try {
      const personal = await fetchMatchday(`?gw=${day.event}&entry=${entry}`);
      const matches = new Set<number>();
      const squad = new Set<number>();
      for (const m of allMatches(personal)) {
        for (const p of m.players) {
          if (!p.mine) continue;
          matches.add(m.id);
          squad.add(p.id);
        }
      }
      mine.set(entry, { matches, squad });
    } catch {
      // A team FPL cannot find just gets no "mine" matches.
    }
  }

  const token = await apnsToken();
  const gone: string[] = [];
  let sent = 0;
  for (const d of devices) {
    const team = mine.get(entryOf(d) ?? 0) ?? { matches: new Set<number>(), squad: new Set<number>() };
    const prefs = { scope: d.scope, goals: d.goals, redCards: d.red_cards, fullTime: d.full_time };
    for (const e of events.filter((ev: LiveEvent) => wants(prefs, ev, team.matches))) {
      const { title, body } = message(e, team.squad);
      const res = await fetch(`${APNS_HOST[d.environment]}/3/device/${d.token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${token}`,
          "apns-topic": TOPIC,
          "apns-push-type": "alert",
          "apns-priority": "10",
        },
        body: JSON.stringify({
          aps: { alert: { title, body }, sound: "default", "thread-id": `match-${e.matchId}` },
          matchId: e.matchId,
        }),
      });
      if (res.ok) sent++;
      // The app was deleted or the token replaced: stop sending to it.
      else if (res.status === 410 || (await res.text()).includes("BadDeviceToken")) {
        gone.push(d.token);
        break;
      }
    }
  }
  if (gone.length) await db.from("push_devices").delete().in("token", gone);
  return Response.json({ events: events.length, devices: devices.length, sent, removed: gone.length });
});
