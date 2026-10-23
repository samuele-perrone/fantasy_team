/**
 * Writes the iOS app's sample API responses, using the same model code the server runs.
 *
 *   npx tsx scripts/ios-fixtures.mts [fpl-team-id]
 *
 * The app shows these in its debug-only demo mode, and its unit tests decode them, so they are
 * the contract between `/api/v1` and the Swift models. Regenerate them whenever a response
 * shape changes: a field renamed on the server then fails the iOS tests instead of failing
 * silently on a phone. Built from live FPL data, so the numbers are realistic.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildContext, projectAll } from "../src/lib/fpl/projection";
import { toRow } from "../src/lib/fpl/row";
import { readRules } from "../src/lib/fpl/rules";
import { bestSwapFor, computeVerdicts, suggestTransfers, type VerdictInput } from "../src/lib/fpl/verdict";
import { buildMatch, groupByDay } from "../src/lib/fpl/matches";
import { buildSchedules, type OtherMatch } from "../src/lib/fpl/schedule";
import { mapClubs, toOtherMatches, type EspnMatch } from "../src/lib/football/clubs";
import type { Bootstrap, FplFixture } from "../src/lib/fpl/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "ios/FantasyTeamHub/Resources/Fixtures");
const entryId = Number(process.argv[2] ?? 849650);

const UA = { "User-Agent": "Mozilla/5.0 (Macintosh) Chrome/125", Accept: "application/json" };
const get = async <T,>(url: string): Promise<T> => (await fetch(url, { headers: UA })).json() as Promise<T>;
const fpl = <T,>(path: string) => get<T>(`https://fantasy.premierleague.com/api${path}`);

const bootstrap = await fpl<Bootstrap>("/bootstrap-static/");
const fixtures = await fpl<FplFixture[]>("/fixtures/");

// European and cup fixtures, as src/lib/football/client.ts reads them.
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const espnTeams = (await get<{ sports: { leagues: { teams: { team: never }[] }[] }[] }>(`${ESPN}/eng.1/teams`))
  .sports[0].leagues[0].teams.map((t) => t.team);
const clubs = mapClubs(espnTeams, bootstrap.teams);
const others: OtherMatch[] = [];
for (const [slug, name] of [["uefa.champions", "Champions League"], ["uefa.europa", "Europa League"], ["uefa.europa.conf", "Conference League"], ["eng.fa", "FA Cup"], ["eng.league_cup", "EFL Cup"]]) {
  const events: { id: string; date: string; status: { type: { name: string } }; competitions: { competitors: { homeAway: string; team: { id: string; displayName: string } }[] }[] }[] = [];
  for (const y of [2026, 2027]) events.push(...((await get<{ events?: typeof events }>(`${ESPN}/${slug}/scoreboard?dates=${y}&limit=1000`)).events ?? []));
  const matches: EspnMatch[] = events
    .filter((e) => Date.parse(e.date) >= Date.UTC(2026, 6, 1))
    .map((e) => {
      const c = e.competitions[0].competitors;
      const h = c.find((x) => x.homeAway === "home")!.team;
      const a = c.find((x) => x.homeAway === "away")!.team;
      return { id: e.id, date: e.date, status: e.status.type.name, home: { id: h.id, name: h.displayName }, away: { id: a.id, name: a.displayName } };
    });
  others.push(...toOtherMatches(matches, clubs, name));
}
const schedules = buildSchedules(fixtures, others);

const ctx = buildContext(bootstrap, fixtures);
const projections = projectAll(bootstrap, ctx, 5);
const teams = new Map(bootstrap.teams.map((t) => [t.id, t]));
const rows = bootstrap.elements
  .filter((p) => p.status !== "u")
  .map((p) => toRow(p, projections.get(p.id)!, teams, schedules.get(p.team)));
const byId = new Map(rows.map((r) => [r.id, r]));

// My Squad, as getSquadView builds it.
const entry = await fpl<{ name: string; player_first_name: string; player_last_name: string; current_event: number }>(`/entry/${entryId}/`);
const picks = await fpl<{ picks: { element: number }[]; entry_history: { bank: number } }>(`/entry/${entryId}/event/${entry.current_event}/picks/`);
const squad = picks.picks.map((p) => byId.get(p.element)!).filter(Boolean);
const input: VerdictInput = {
  squad,
  pool: rows,
  bank: picks.entry_history.bank / 10,
  freeTransfers: 1,
  nextEvent: ctx.nextEvent,
  rules: readRules(bootstrap),
};
const ORDER = { sell: 0, watch: 1, keep: 2 } as const;
const next = bootstrap.events.find((e) => e.id === ctx.nextEvent);
const squadView = {
  // The repository is public: the squad is real, its owner is not named.
  team: {
    entryId: 1,
    name: "Demo XI",
    managerName: "Demo Manager",
    event: entry.current_event,
    nextEvent: ctx.nextEvent,
    deadline: next?.deadline_time ?? null,
    bank: input.bank,
    freeTransfers: input.freeTransfers,
  },
  verdicts: computeVerdicts(input).sort((a, b) => ORDER[a.verdict] - ORDER[b.verdict] || a.player.posId - b.player.posId),
  suggestions: suggestTransfers(input),
};

// Watchlist: the top three suggestions, each against the player they would replace.
const watchIds = squadView.suggestions.slice(0, 3).map((s) => s.player.id);
const watchlist = {
  players: watchIds.map((id) => {
    const player = byId.get(id)!;
    return { player, swap: bestSwapFor(player, input) };
  }),
};

// Matches: last finished gameweek, so every kind of incident appears.
const gw = ctx.nextEvent - 1;
const live = new Map(
  (await fpl<{ elements: { id: number }[] }>(`/event/${gw}/live/`)).elements.map((e) => [e.id, e as never]),
);
const matchCtx = {
  teams,
  elements: new Map(bootstrap.elements.map((e) => [e.id, e])),
  live,
  squadIds: new Set(squad.map((p) => p.id)),
  watchIds: new Set(watchIds),
};
const ids = bootstrap.events.map((e) => e.id);
const matches = fixtures.filter((f) => f.event === gw).map((f) => buildMatch(f, matchCtx));
const matchday = {
  event: gw,
  prev: ids.includes(gw - 1) ? gw - 1 : null,
  next: ids.includes(gw + 1) ? gw + 1 : null,
  live: matches.some((m) => m.status === "live"),
  hasSquad: true,
  days: groupByDay(matches),
};

// Players: the default view, first page.
const players = {
  players: [...rows].sort((a, b) => b.xPts - a.xPts || a.id - b.id).slice(0, 30),
  total: rows.length,
  query: { q: "", pos: null, team: null, maxPrice: null, sort: "points5", limit: 30 },
  teams: bootstrap.teams.map((t) => ({ id: t.id, name: t.name, short: t.short_name })).sort((a, b) => a.name.localeCompare(b.name)),
};

await mkdir(out, { recursive: true });
const savedTeams = {
  active: 1,
  teams: [
    { entryId: 1, name: "Demo XI", managerName: "Demo Manager" },
    { entryId: 2, name: "Second Squad", managerName: "Demo Manager" },
  ],
};
for (const [name, body] of Object.entries({ squad: squadView, watchlist, matches: matchday, players, profile: { entryId: 1 }, teams: savedTeams })) {
  await writeFile(join(out, `${name}.json`), JSON.stringify(body, null, 1) + "\n");
}
console.log(`Wrote ${out}: squad (${squad.length}), watchlist (${watchIds.length}), matches GW${gw} (${matches.length}), players (${players.players.length})`);
