#!/usr/bin/env node
/**
 * Measures how well the projection model actually predicts.
 *
 * FPL does not expose per-gameweek data for past seasons — `history_past` carries season
 * totals only — so last season cannot be replayed. Accuracy has to be accumulated forward
 * instead: snapshot projections before a deadline, score them once the gameweek finishes.
 *
 *   npx tsx scripts/backtest.mjs snapshot     write projections for the upcoming gameweek
 *   npx tsx scripts/backtest.mjs score        score every snapshot whose gameweek is done
 *   npx tsx scripts/backtest.mjs gw1          one-off out-of-sample check on gameweek one
 *
 * Run through tsx so the TypeScript model can be imported directly.
 *
 * `gw1` is possible without a snapshot because before the season starts every current-season
 * stat is zero, so that state can be reconstructed exactly: zero the stats, and the model is
 * left with last season's priors, price and fixtures — precisely what it knew at the time.
 */
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "backtest");

const { buildContext, projectAll, projectForEvent } = await import(
  join(root, "src/lib/fpl/projection.ts")
);

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

async function fpl(path) {
  const res = await fetch(`https://fantasy.premierleague.com/api${path}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`FPL ${res.status} for ${path}`);
  return res.json();
}

/** Mean absolute error, bias and correlation between prediction and outcome. */
function metrics(rows) {
  const n = rows.length;
  if (!n) return null;
  const mae = rows.reduce((a, r) => a + Math.abs(r.projected - r.actual), 0) / n;
  const bias = rows.reduce((a, r) => a + (r.projected - r.actual), 0) / n;
  const rmse = Math.sqrt(rows.reduce((a, r) => a + (r.projected - r.actual) ** 2, 0) / n);

  const mp = rows.reduce((a, r) => a + r.projected, 0) / n;
  const ma = rows.reduce((a, r) => a + r.actual, 0) / n;
  const cov = rows.reduce((a, r) => a + (r.projected - mp) * (r.actual - ma), 0);
  const sp = Math.sqrt(rows.reduce((a, r) => a + (r.projected - mp) ** 2, 0));
  const sa = Math.sqrt(rows.reduce((a, r) => a + (r.actual - ma) ** 2, 0));
  const corr = sp && sa ? cov / (sp * sa) : 0;

  return { n, mae, bias, rmse, corr, meanProjected: mp, meanActual: ma };
}

function report(label, rows) {
  const m = metrics(rows);
  if (!m) return console.log(`  ${label}: no data`);
  console.log(
    `  ${label.padEnd(22)} n=${String(m.n).padStart(4)}  MAE=${m.mae.toFixed(2)}  ` +
      `bias=${m.bias >= 0 ? "+" : ""}${m.bias.toFixed(2)}  RMSE=${m.rmse.toFixed(2)}  ` +
      `r=${m.corr.toFixed(2)}  (pred ${m.meanProjected.toFixed(2)} vs actual ${m.meanActual.toFixed(2)})`,
  );
}

const POS = ["", "GKP", "DEF", "MID", "FWD"];

async function snapshot() {
  const [boot, fixtures] = await Promise.all([fpl("/bootstrap-static/"), fpl("/fixtures/")]);
  const next = boot.events.find((e) => e.is_next);
  if (!next) return console.log("No upcoming gameweek to snapshot.");

  // Refuse to overwrite a snapshot once the deadline has passed — the whole point is that
  // the stored projection is what the model believed *before* kick-off.
  const deadline = new Date(next.deadline_time);
  if (Date.now() > deadline.getTime()) {
    return console.log(
      `GW${next.id} deadline has passed; keeping the existing snapshot rather than overwriting it.`,
    );
  }

  const ctx = buildContext(boot, fixtures);
  const proj = projectAll(boot, ctx, 1);

  const rows = boot.elements
    .filter((p) => (ctx.fixturesByTeam.get(p.team) ?? []).some((f) => f.event === next.id))
    .map((p) => ({
      id: p.id,
      name: p.web_name,
      pos: p.element_type,
      cost: p.now_cost / 10,
      projected: Math.round((proj.get(p.id)?.next ?? 0) * 100) / 100,
    }));

  await mkdir(dir, { recursive: true });
  const file = join(dir, `gw${next.id}.json`);
  await writeFile(
    file,
    JSON.stringify(
      {
        event: next.id,
        takenAt: new Date().toISOString(),
        deadline: next.deadline_time,
        // How stale the projection was when stored. Team news lands close to the deadline,
        // so a snapshot taken hours earlier is measuring a slightly different model.
        hoursBeforeDeadline:
          Math.round(((deadline.getTime() - Date.now()) / 3_600_000) * 10) / 10,
        rows,
      },
      null,
      0,
    ),
  );
  console.log(
    `Snapshotted ${rows.length} projections for GW${next.id} ` +
      `(${Math.round((deadline.getTime() - Date.now()) / 3_600_000)}h before deadline) -> ${file}`,
  );
}

async function score() {
  const boot = await fpl("/bootstrap-static/");
  const finished = new Set(boot.events.filter((e) => e.finished).map((e) => e.id));

  let files = [];
  try {
    files = (await readdir(dir)).filter((f) => /^gw\d+\.json$/.test(f));
  } catch {
    return console.log("No snapshots yet — run `snapshot` before a deadline.");
  }

  const all = [];
  for (const file of files.sort()) {
    const snap = JSON.parse(await readFile(join(dir, file), "utf8"));
    if (!finished.has(snap.event)) {
      console.log(`  GW${snap.event}: not finished yet, skipping`);
      continue;
    }
    const live = await fpl(`/event/${snap.event}/live/`);
    const actual = new Map(live.elements.map((e) => [e.id, e.stats.total_points]));
    const rows = snap.rows
      .filter((r) => actual.has(r.id))
      .map((r) => ({ ...r, actual: actual.get(r.id) }));

    const staleness =
      snap.hoursBeforeDeadline !== undefined
        ? ` (snapshot taken ${snap.hoursBeforeDeadline}h before the deadline)`
        : "";
    console.log(`\nGW${snap.event}${staleness}`);
    report("all players", rows);
    for (const pos of [1, 2, 3, 4]) report(POS[pos], rows.filter((r) => r.pos === pos));
    all.push(...rows);
  }

  if (all.length) {
    console.log("\nAcross all scored gameweeks");
    report("all players", all);
  }
}

/**
 * Out-of-sample check on gameweek one, reconstructed rather than snapshotted.
 * Only players whose club has actually played are scored.
 */
async function gw1() {
  const [boot, fixtures] = await Promise.all([fpl("/bootstrap-static/"), fpl("/fixtures/")]);

  const playedTeams = new Set();
  for (const f of fixtures) {
    if (f.minutes > 0) {
      playedTeams.add(f.team_h);
      playedTeams.add(f.team_a);
    }
  }
  if (!playedTeams.size) return console.log("No completed fixtures yet.");

  // Rewind to the pre-season state: before gameweek one every current-season stat was zero,
  // so zeroing them leaves exactly the information the model had before the deadline.
  const ZERO = [
    "minutes", "starts", "goals_scored", "assists", "clean_sheets", "penalties_saved",
    "yellow_cards", "red_cards", "saves", "bonus", "bps", "total_points", "event_points",
    "defensive_contribution", "recoveries", "tackles",
  ];
  const ZERO_STR = [
    "expected_goals", "expected_assists", "expected_goal_involvements",
    "influence", "creativity", "threat", "ict_index",
  ];
  const ZERO_NUM90 = [
    "expected_goals_per_90", "expected_assists_per_90", "expected_goal_involvements_per_90",
    "expected_goals_conceded_per_90", "saves_per_90", "defensive_contribution_per_90",
  ];

  const rewound = {
    ...boot,
    elements: boot.elements.map((p) => {
      const q = { ...p };
      for (const k of ZERO) q[k] = 0;
      for (const k of ZERO_STR) q[k] = "0.0";
      for (const k of ZERO_NUM90) q[k] = 0;
      return q;
    }),
  };
  // Fixtures as they stood before kick-off, so nothing counts as played.
  const preFixtures = fixtures.map((f) => ({
    ...f,
    finished: false,
    finished_provisional: false,
    started: false,
    minutes: 0,
  }));

  const ctx = buildContext(rewound, preFixtures);
  const live = await fpl("/event/1/live/");
  const actual = new Map(live.elements.map((e) => [e.id, e.stats.total_points]));

  const rows = rewound.elements
    .filter((p) => playedTeams.has(p.team) && actual.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.web_name,
      pos: p.element_type,
      cost: p.now_cost / 10,
      projected: projectForEvent(p, ctx, 1),
      actual: actual.get(p.id),
    }));

  console.log(`Out-of-sample check on GW1 — ${playedTeams.size} clubs, ${rows.length} players\n`);
  report("all players", rows);
  for (const pos of [1, 2, 3, 4]) report(POS[pos], rows.filter((r) => r.pos === pos));
  report("played (mins > 0)", rows.filter((r) => actual.get(r.id) > 0));

  const sorted = [...rows].sort((a, b) => b.actual - a.actual).slice(0, 8);
  console.log("\n  biggest scorers, predicted vs actual:");
  for (const r of sorted) {
    console.log(
      `    ${r.name.padEnd(14)} ${POS[r.pos]}  predicted ${r.projected.toFixed(2).padStart(5)}  actual ${String(r.actual).padStart(3)}`,
    );
  }
}

const mode = process.argv[2] ?? "score";
if (mode === "snapshot") await snapshot();
else if (mode === "gw1") await gw1();
else await score();
