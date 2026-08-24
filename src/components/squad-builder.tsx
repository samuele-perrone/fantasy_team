"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PlayerRow } from "@/lib/fpl/row";
import { FixtureRun, PositionBadge } from "./ui";
import { ScreenshotImport, type ImportMatch } from "./screenshot-import";
import { BuilderPitch } from "./builder-pitch";
import { optimiseSquad } from "@/lib/fpl/optimiser";
import { formationsFor, type SquadRules } from "@/lib/fpl/rules";
import { rowNewsLabel } from "@/lib/fpl/news";
import { saveDraft } from "@/lib/supabase/squads";
import { cn, money } from "@/lib/utils";

const POS_LABEL: Record<number, string> = {
  1: "Goalkeepers",
  2: "Defenders",
  3: "Midfielders",
  4: "Forwards",
};

export type Formation = [number, number, number];

// 3-4-3 by default: the auto-pick optimises for this shape unless the formation is changed.
const DEFAULT_FORMATION: Formation = [3, 4, 3];

/** Auto-pick judges players on their next three fixtures rather than the full five. */
const AUTOPICK_HORIZON = 3;

/**
 * Choose the XI for a given shape, keeping whoever is already starting where possible so
 * changing formation does not silently rebuild a line-up the user hand-picked.
 */
function pickXI(squad: PlayerRow[], formation: Formation, keep: Set<number>): number[] {
  const need: Record<number, number> = { 1: 1, 2: formation[0], 3: formation[1], 4: formation[2] };
  const out: number[] = [];

  for (const pos of [1, 2, 3, 4]) {
    const ranked = squad
      .filter((p) => p.posId === pos)
      .sort(
        (a, b) =>
          Number(keep.has(b.id)) - Number(keep.has(a.id)) || b.xPtsNext - a.xPtsNext,
      );
    out.push(...ranked.slice(0, need[pos]).map((p) => p.id));
  }
  return out;
}

export function SquadBuilder({
  players,
  teamCodes,
  initialIds,
  initialCaptain,
  initialVice,
  initialBank,
  initialName,
  canPersist = false,
  rules,
}: {
  players: PlayerRow[];
  teamCodes: Record<number, number>;
  initialIds: number[];
  initialCaptain: number | null;
  initialVice: number | null;
  initialBank: number;
  initialName: string;
  /** signed in, so the working squad can be autosaved to the account */
  canPersist?: boolean;
  /** squad rules as FPL publishes them, rather than assumed here */
  rules: SquadRules;
}) {
  const QUOTA = rules.quota;
  const TEAM_LIMIT = rules.teamLimit;
  const router = useRouter();
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const [ids, setIds] = useState<number[]>(initialIds);
  const [formation, setFormation] = useState<Formation>(DEFAULT_FORMATION);
  const [chosenXI, setChosenXI] = useState<number[] | null>(null);
  const [captain, setCaptain] = useState<number | null>(initialCaptain);
  const [vice, setVice] = useState<number | null>(initialVice);
  const [bank, setBank] = useState(String(initialBank));
  const [name, setName] = useState(initialName);
  const [query, setQuery] = useState("");
  const [posFilter, setPosFilter] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [optimising, setOptimising] = useState(false);
  // Replacing a squad you built is destructive, so it takes a second click to confirm.
  const [confirmAuto, setConfirmAuto] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Rumoured or agreed-but-unofficial transfers have no representation in the FPL API — a
  // player stays fully available until the move completes — so exclusions are manual.
  const [excluded, setExcluded] = useState<number[]>([]);
  const [excludeQuery, setExcludeQuery] = useState("");
  const [prefs, setPrefs] = useState({
    fitOnly: true,
    nailed: true,
    easyFixture: true,
    penalties: true,
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const squadRef = useRef<HTMLDivElement>(null);

  const squad = ids.map((id) => byId.get(id)).filter((p): p is PlayerRow => Boolean(p));
  const cost = squad.reduce((a, p) => a + p.cost, 0);
  const bankValue = Number(bank) || 0;

  const counts = (pos: number) => squad.filter((p) => p.posId === pos).length;
  // `squad` is derived fresh each render, so this is cheap and memoising it would be a no-op.
  const clubCounts = new Map<number, number>();
  for (const p of squad) clubCounts.set(p.teamId, (clubCounts.get(p.teamId) ?? 0) + 1);

  // The XI is derived from the chosen formation, and only overridden while the manual choice
  // still describes a full, present eleven. Removing a player therefore re-derives cleanly.
  const manualValid =
    chosenXI !== null &&
    chosenXI.length === 11 &&
    chosenXI.every((id) => ids.includes(id));
  // pickXI takes up to the shape's quota per position, so a part-built squad still fills the
  // pitch from the front rather than piling everyone onto the bench.
  const starterIds = manualValid
    ? chosenXI!
    : pickXI(squad, formation, new Set(chosenXI ?? []));

  const starterSet = new Set(starterIds);
  const starters = squad.filter((p) => starterSet.has(p.id));
  const bench = squad.filter((p) => !starterSet.has(p.id));
  const complete = squad.length === 15 && starters.length === 11;

  const errors: string[] = [];
  if (squad.length !== 15) errors.push(`Pick 15 players — you have ${squad.length}.`);
  for (const [pos, quota] of Object.entries(QUOTA)) {
    const n = counts(Number(pos));
    if (n !== quota) errors.push(`${POS_LABEL[Number(pos)]}: ${n}/${quota}.`);
  }
  for (const [teamId, n] of clubCounts) {
    if (n > TEAM_LIMIT) {
      const club = squad.find((p) => p.teamId === teamId)?.teamName ?? "one club";
      errors.push(`${n} players from ${club} — max is ${TEAM_LIMIT}.`);
    }
  }

  const canAdd = (p: PlayerRow) => {
    if (ids.includes(p.id)) return "Already picked";
    if (counts(p.posId) >= QUOTA[p.posId])
      return `You already have ${QUOTA[p.posId]} ${POS_LABEL[p.posId].toLowerCase()}`;
    if ((clubCounts.get(p.teamId) ?? 0) >= TEAM_LIMIT) return `Max ${TEAM_LIMIT} from ${p.team}`;
    return null;
  };

  const add = (p: PlayerRow) => {
    if (canAdd(p)) return;
    setIds((prev) => [...prev, p.id]);
    setQuery("");
    searchRef.current?.focus();
  };

  const remove = (id: number) => {
    setIds((prev) => prev.filter((x) => x !== id));
    setChosenXI((prev) => (prev ? prev.filter((x) => x !== id) : prev));
    if (captain === id) setCaptain(null);
    if (vice === id) setVice(null);
  };

  const applyFormation = (next: Formation) => {
    setFormation(next);
    const xi = pickXI(squad, next, new Set(starterIds));
    setChosenXI(xi.length === 11 ? xi : null);
    const set = new Set(xi);
    if (captain && !set.has(captain)) setCaptain(null);
    if (vice && !set.has(vice)) setVice(null);
  };

  /**
   * Swapping a player in or out always exchanges them with someone in the same position, so
   * the chosen formation is preserved — the same way a straight swap works in FPL itself.
   */
  const toggleStart = (id: number) => {
    const player = byId.get(id);
    if (!player || !complete) return;

    const isStarter = starterSet.has(id);
    const counterparts = (isStarter ? bench : starters).filter(
      (p) => p.posId === player.posId,
    );
    if (!counterparts.length) return;

    const partner = isStarter
      ? counterparts.sort((a, b) => b.xPtsNext - a.xPtsNext)[0]
      : counterparts.sort((a, b) => a.xPtsNext - b.xPtsNext)[0];

    const next = starterIds.filter((x) => x !== id);
    if (isStarter) next.push(partner.id);
    else {
      const idx = next.indexOf(partner.id);
      if (idx >= 0) next.splice(idx, 1);
      next.push(id);
    }
    setChosenXI(next);
    if (isStarter) {
      if (captain === id) setCaptain(null);
      if (vice === id) setVice(null);
    } else if (captain === partner.id) setCaptain(null);
    else if (vice === partner.id) setVice(null);
  };

  /** Slots the chosen shape still needs on the pitch, as opposed to anywhere in the 15. */
  const shapeNeeds: Record<number, number> = {
    1: 1,
    2: formation[0],
    3: formation[1],
    4: formation[2],
  };
  const grassGap = (pos: number) =>
    Math.max(0, shapeNeeds[pos] - starters.filter((p) => p.posId === pos).length);

  /** Can this player be swapped without breaking the chosen shape? */
  const swapReason = (id: number): string | null => {
    const player = byId.get(id);
    if (!player) return "Unknown player";
    if (!complete) return "Complete your 15 first";
    const pool = starterSet.has(id) ? bench : starters;
    return pool.some((p) => p.posId === player.posId)
      ? null
      : "Change formation to free up a slot";
  };

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = players.filter((p) => !ids.includes(p.id));
    if (posFilter) list = list.filter((p) => p.posId === posFilter);
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.fullName.toLowerCase().includes(q) ||
          p.team.toLowerCase().includes(q) ||
          p.teamName.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => b.xPts - a.xPts).slice(0, 40);
  }, [players, query, posFilter, ids]);

  const applyImport = (matches: ImportMatch[]) => {
    const next: number[] = [];
    const posCount: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const clubs = new Map<number, number>();
    for (const m of matches) {
      if (!m.player || !m.selected || next.includes(m.player.id)) continue;
      const p = m.player;
      if (posCount[p.posId] >= QUOTA[p.posId]) continue;
      if ((clubs.get(p.teamId) ?? 0) >= TEAM_LIMIT) continue;
      next.push(p.id);
      posCount[p.posId]++;
      clubs.set(p.teamId, (clubs.get(p.teamId) ?? 0) + 1);
    }
    setIds(next);
    setCaptain(null);
    setVice(null);
    setNotice(
      next.length < 15
        ? `Imported ${next.length} players. Add the missing ${15 - next.length} by searching on the left.`
        : `Imported all 15 players. Set your captain, then hit Analyse.`,
    );
    // Drop the user straight onto the squad they just imported.
    requestAnimationFrame(() =>
      squadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  /**
   * Fill the builder with the optimiser's best legal squad. Runs in the browser — the solver
   * is a greedy sweep plus local search over ~600 players, a few milliseconds — but it is
   * deferred a frame so the button can paint its pending state first.
   */
  /** Re-score every player over just the auto-pick horizon rather than the full five. */
  const scopedPlayers = () => {
    const firstEvent = Math.min(
      ...players.flatMap((p) => p.fixtures.map((f) => f.event)).filter(Number.isFinite),
    );
    return players.map((p) => {
      const within = p.fixtures.filter((f) => f.event < firstEvent + AUTOPICK_HORIZON);
      return {
        ...p,
        fixtures: within,
        xPts: Math.round(within.reduce((a, f) => a + f.xPts, 0) * 100) / 100,
      };
    });
  };

  /**
   * Drop one player and slot in the best legal replacement, keeping everyone else untouched.
   * The player is added to the exclusion list so a later auto-pick does not simply bring them
   * back, which is the whole point of removing them by hand.
   */
  const replacePlayer = (id: number) => {
    const out = byId.get(id);
    if (!out) return;

    const budget = squad.length === rules.squadSize ? cost + bankValue : rules.budget;
    const spare = budget - (cost - out.cost);
    const clubCount = (teamId: number) =>
      squad.filter((p) => p.teamId === teamId && p.id !== id).length;

    const candidate = scopedPlayers()
      .filter(
        (p) =>
          p.posId === out.posId &&
          p.id !== id &&
          !ids.includes(p.id) &&
          !excluded.includes(p.id) &&
          p.cost <= spare + 1e-9 &&
          clubCount(p.teamId) < TEAM_LIMIT &&
          (!prefs.fitOnly || rowNewsLabel(p) === null) &&
          (!prefs.nailed || p.startProb >= 0.75),
      )
      .sort(
        (a, b) =>
          b.xPts +
          (prefs.penalties && b.penaltyOrder === 1 ? 1.5 : 0) -
          (a.xPts + (prefs.penalties && a.penaltyOrder === 1 ? 1.5 : 0)),
      )[0];

    setExcluded((prev) => (prev.includes(id) ? prev : [...prev, id]));

    if (!candidate) {
      setNotice(
        `No affordable replacement for ${out.name} at ${money(spare)} that meets the current preferences. They have been excluded — turn a preference off or free up funds.`,
      );
      return;
    }

    // Swap in place so the player keeps the outgoing player's XI or bench slot.
    setIds((prev) => prev.map((x) => (x === id ? candidate.id : x)));
    setChosenXI((prev) => (prev ? prev.map((x) => (x === id ? candidate.id : x)) : prev));
    if (captain === id) setCaptain(null);
    if (vice === id) setVice(null);

    setNotice(
      `Replaced ${out.name} with ${candidate.name} (${candidate.team}, ${money(candidate.cost)}) — ` +
        `${candidate.xPts.toFixed(1)} projected points over the next ${AUTOPICK_HORIZON} gameweeks, ` +
        `against ${out.name}'s ${scopedPlayers().find((p) => p.id === id)?.xPts.toFixed(1) ?? "?"}.`,
    );
  };

  const autoPick = () => {
    setOptimising(true);
    requestAnimationFrame(() => {
      const budget = squad.length === rules.squadSize ? cost + bankValue : rules.budget;

      const scoped = scopedPlayers();

      const result = optimiseSquad(scoped, {
        budget,
        banned: excluded,
        key: "xPts",
        benchWeight: 0.12,
        formation,
        fitOnly: prefs.fitOnly,
        // Expected minutes are probability weighted and peak near 76, so "plays the whole
        // match" is expressed as a high chance of starting rather than a minutes threshold.
        minStartProb: prefs.nailed ? 0.75 : undefined,
        maxNextDifficulty: prefs.easyFixture ? 3 : undefined,
        penaltyBonus: prefs.penalties ? 1.5 : 0,
        rules,
      });

      if (result.squad.length !== 15) {
        setNotice("Could not build a legal squad within that budget.");
        setOptimising(false);
        return;
      }

      const xi = result.xi.starters.map((p) => p.id);
      setIds([...xi, ...result.xi.bench.map((p) => p.id)]);
      setChosenXI(xi);
      const [d, m, f] = result.xi.formation.split("-").map(Number);
      setFormation([d, m, f]);
      setCaptain(result.xi.captain?.id ?? null);
      setVice(result.xi.viceCaptain?.id ?? null);
      // Projections already discount players by their news, but say so explicitly if any
      // flagged player still earned a place.
      const flagged = result.squad
        .map((p) => ({ p, label: rowNewsLabel(p) }))
        .filter((x) => x.label);

      setNotice(
        `Auto-picked the best ${result.xi.formation} for ${money(result.cost)} — ` +
          `${result.xi.startingPoints.toFixed(1)} projected points from the XI over the next ${AUTOPICK_HORIZON} gameweeks.` +
          (result.relaxed.length
            ? ` Could not satisfy ${result.relaxed.join(" or ")}, so that was relaxed.`
            : "") +
          (flagged.length
            ? ` Includes ${flagged.length} flagged: ${flagged
                .map((x) => `${x.p.name} (${x.label})`)
                .join(", ")}.`
            : " Injured and suspended players were priced out by their news."),
      );
      setOptimising(false);
      squadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  /**
   * Autosave the working squad. Debounced so a burst of edits is one write, and deliberately
   * fire-and-forget: losing an autosave is not worth interrupting the user for, so failures
   * surface as a quiet indicator rather than an error.
   */
  const signature = `${ids.join(",")}|${captain ?? ""}|${vice ?? ""}|${bankValue}|${formation.join("-")}`;
  const lastSaved = useRef<string | null>(null);

  useEffect(() => {
    if (!canPersist) return;
    // Skip the first render, which reflects what was just loaded from the server.
    if (lastSaved.current === null) {
      lastSaved.current = signature;
      return;
    }
    if (lastSaved.current === signature) return;

    const timer = setTimeout(async () => {
      setSaveState("saving");
      const res = await saveDraft({
        playerIds: ids,
        captainId: captain,
        viceCaptainId: vice,
        formation: formation.join("-"),
        bank: bankValue,
      });
      lastSaved.current = signature;
      setSaveState(res.ok ? "saved" : "error");
    }, 1200);

    return () => clearTimeout(timer);
  }, [signature, canPersist, ids, captain, vice, bankValue, formation]);

  const analyse = () => {
    const ordered = [...starters, ...bench].map((p) => p.id);
    const q = new URLSearchParams({ squad: ordered.join(",") });
    if (captain) q.set("c", String(captain));
    if (vice) q.set("v", String(vice));
    if (bankValue) q.set("bank", String(bankValue));
    if (name.trim()) q.set("name", name.trim());
    router.push(`/my-team?${q.toString()}`);
  };

  return (
    <div className="space-y-5">
      <ScreenshotImport players={players} onImport={applyImport} />

      <div ref={squadRef} className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
        {/* ---------------- picker ---------------- */}
        <section className="panel flex flex-col overflow-hidden">
          <div className="border-b border-pitch-800 px-4 py-3">
            <div className="mb-2 text-[13px] font-bold text-white">
              {squad.length ? "Add or replace players" : "Search for your players"}
              <span className="ml-2 font-normal text-slate-500">
                {squad.length}/15 picked
              </span>
            </div>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a player to add…"
              className="h-10 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 text-[14px] outline-none placeholder:text-slate-600 focus:border-brand-500"
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {[0, 1, 2, 3, 4].map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setPosFilter(pos)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[12px] font-semibold transition",
                    posFilter === pos
                      ? "bg-brand-500 text-pitch-950"
                      : "bg-pitch-800 text-slate-400 hover:text-white",
                  )}
                >
                  {pos === 0 ? "All" : ["", "GKP", "DEF", "MID", "FWD"][pos]}
                  {pos > 0 && (
                    <span className="ml-1 opacity-70">
                      {counts(pos)}/{QUOTA[pos]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <ul className="max-h-[520px] divide-y divide-pitch-800/60 overflow-y-auto">
            {suggestions.map((p) => {
              const blocked = canAdd(p);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => add(p)}
                    disabled={Boolean(blocked)}
                    title={blocked ?? `Add ${p.name}`}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-left transition enabled:hover:bg-pitch-800/60 disabled:opacity-35"
                  >
                    <PositionBadge pos={p.pos} />
                    <span className="text-[13px] font-semibold text-white">{p.name}</span>
                    <span className="text-[11px] text-slate-500">{p.team}</span>
                    {p.daysAtClub !== null && p.daysAtClub < 150 && (
                      <span
                        title={`Joined ${p.team} ${p.daysAtClub} days ago — their minutes were played for a different club, so their place in this side is less certain`}
                        className="rounded bg-accent-500/20 px-1 text-[9.5px] font-bold uppercase tracking-wide text-accent-400"
                      >
                        New
                      </span>
                    )}
                    <span className="num ml-auto text-[12px] text-slate-300">
                      {money(p.cost)}
                    </span>
                    <span className="num w-10 text-right text-[12px] font-bold text-brand-400">
                      {p.xPts.toFixed(1)}
                    </span>
                  </button>
                </li>
              );
            })}
            {!suggestions.length && (
              <li className="px-4 py-8 text-center text-[13px] text-slate-500">
                No players match that search.
              </li>
            )}
          </ul>
        </section>

        {/* ---------------- squad ---------------- */}
        <section className="space-y-4">
          {notice && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-2.5 text-[12.5px] text-brand-300">
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="ml-auto text-[11px] text-brand-400/70 hover:text-brand-300"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="panel px-4 py-3.5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Squad name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My squad"
                  className="h-9 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 text-[13.5px] outline-none placeholder:text-slate-600 focus:border-brand-500"
                />
              </Field>
              <Field label="In the bank (£m)">
                <input
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  inputMode="decimal"
                  className="h-9 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 text-[13.5px] outline-none focus:border-brand-500"
                />
              </Field>
              <div className="flex items-end">
                <div className="w-full rounded-lg bg-pitch-900 px-3 py-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Squad cost
                  </div>
                  <div
                    className={cn(
                      "num text-[16px] font-bold",
                      cost > 100 ? "text-amber-400" : "text-white",
                    )}
                  >
                    {money(cost)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-pitch-700">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  squad.length === 15 ? "bg-brand-500" : "bg-accent-500",
                )}
                style={{ width: `${(squad.length / 15) * 100}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-slate-500">
              <span>{squad.length} of 15 picked</span>
              <span className="num">
                {money(cost + bankValue)} total value
              </span>
            </div>
          </div>

          <div className="panel flex flex-wrap items-center gap-2 px-4 py-2.5">
            <button
              type="button"
              disabled={optimising}
              onClick={() => {
                if (squad.length > 0 && !confirmAuto) {
                  setConfirmAuto(true);
                  return;
                }
                setConfirmAuto(false);
                autoPick();
              }}
              onBlur={() => setConfirmAuto(false)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-[12.5px] font-bold transition disabled:opacity-50",
                confirmAuto
                  ? "bg-amber-500 text-pitch-950 hover:bg-amber-400"
                  : "bg-brand-500 text-pitch-950 hover:bg-brand-400",
              )}
            >
              {optimising
                ? "Optimising…"
                : confirmAuto
                  ? `Replace all ${squad.length}?`
                  : squad.length
                    ? "Auto-pick best squad"
                    : "Auto-pick the best squad"}
            </button>

            <span className="mr-1 text-[11.5px] text-slate-500">
              {squad.length === rules.squadSize ? `within ${money(cost + bankValue)}` : `within ${money(rules.budget)}`} ·
              next {AUTOPICK_HORIZON} GWs
            </span>

            <span className="ml-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Formation
            </span>
            <div className="flex flex-wrap gap-1">
              {formationsFor(rules).map((f) => {
                const label = f.join("-");
                const active = f[0] === formation[0] && f[1] === formation[1] && f[2] === formation[2];
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => applyFormation(f as Formation)}
                    disabled={!squad.length}
                    title={squad.length ? `Switch to ${label}` : "Add players first"}
                    className={cn(
                      "num rounded-md px-2.5 py-1 text-[12px] font-bold transition disabled:opacity-30",
                      active
                        ? "bg-brand-500 text-pitch-950"
                        : "bg-pitch-800 text-slate-400 enabled:hover:text-white",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="panel px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Auto-pick prefers
            </span>
            {(
              [
                ["fitOnly", "Fully fit", "Excludes injured, doubtful, suspended and just-returned players"],
                ["nailed", "Nailed starters", "At least a 75% chance of starting. Expected minutes peak near 76 across the whole game, so a literal 80-minute threshold would match nobody"],
                ["easyFixture", "Kind next fixture", "Next match rated 3 or easier out of 5"],
                ["penalties", "Penalty takers", "Favours penalty takers rather than requiring them — no keeper and only two defenders in the game take them"],
              ] as const
            ).map(([k, label, help]) => (
              <label
                key={k}
                title={help}
                className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-slate-300"
              >
                <input
                  type="checkbox"
                  checked={prefs[k]}
                  onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })}
                  className="accent-brand-500"
                />
                {label}
              </label>
            ))}
          </div>

          <div className="relative mt-2 border-t border-pitch-800 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                title="FPL only marks a player unavailable once a transfer completes, so a rumoured or agreed move is invisible to the data. Exclude those players by hand."
                className="text-[11px] font-bold uppercase tracking-wider text-slate-500"
              >
                Never pick
              </span>
              {excluded.map((id) => {
                const p = byId.get(id);
                if (!p) return null;
                return (
                  <span
                    key={id}
                    className="flex items-center gap-1.5 rounded bg-rose-500/15 px-2 py-1 text-[12px] text-rose-300"
                  >
                    {p.name}
                    <button
                      type="button"
                      onClick={() => setExcluded(excluded.filter((x) => x !== id))}
                      className="text-rose-400/70 hover:text-rose-300"
                      aria-label={`Stop excluding ${p.name}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              <input
                value={excludeQuery}
                onChange={(e) => setExcludeQuery(e.target.value)}
                placeholder="Exclude a player (rumoured transfer, benched, hunch…)"
                className="h-8 min-w-[260px] flex-1 rounded-lg border border-pitch-700 bg-pitch-900 px-2.5 text-[12.5px] outline-none placeholder:text-slate-600 focus:border-brand-500"
              />
            </div>

            {excludeQuery.trim().length > 1 && (
              <ul className="absolute right-0 z-20 mt-1 max-h-56 w-full max-w-md overflow-y-auto rounded-lg border border-pitch-600 bg-pitch-850 shadow-2xl shadow-black/60">
                {players
                  .filter(
                    (p) =>
                      !excluded.includes(p.id) &&
                      (p.name.toLowerCase().includes(excludeQuery.trim().toLowerCase()) ||
                        p.fullName.toLowerCase().includes(excludeQuery.trim().toLowerCase())),
                  )
                  .sort((a, b) => b.xPts - a.xPts)
                  .slice(0, 8)
                  .map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setExcluded([...excluded, p.id]);
                          setExcludeQuery("");
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-pitch-700"
                      >
                        <PositionBadge pos={p.pos} />
                        <span className="text-[13px] font-semibold text-white">{p.name}</span>
                        <span className="text-[11px] text-slate-500">{p.team}</span>
                        <span className="num ml-auto text-[12px] text-slate-400">
                          {money(p.cost)}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
          </div>

          <BuilderPitch
            starters={starters}
            bench={bench}
            grassShortfall={[1, 2, 3, 4].flatMap((pos) =>
              Array.from({ length: grassGap(pos) }, () => pos),
            )}
            benchShortfall={[1, 2, 3, 4].flatMap((pos) =>
              Array.from(
                { length: Math.max(0, QUOTA[pos] - counts(pos) - grassGap(pos)) },
                () => pos,
              ),
            )}
            formation={formation}
            captain={captain}
            vice={vice}
            teamCodes={teamCodes}
            complete={complete}
            squadSize={squad.length}
            swapReason={swapReason}
            onSetCaptain={(id) => setCaptain(captain === id ? null : id)}
            onSetVice={(id) => setVice(vice === id ? null : id)}
            onToggleStart={toggleStart}
            onRemove={remove}
            onReplace={replacePlayer}
            onPickEmpty={(pos) => {
              setPosFilter(pos);
              setQuery("");
              searchRef.current?.focus();
              searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />


          {!squad.length && (
            <div className="panel px-5 py-4 text-center text-[13px] text-slate-400">
              Search on the left to fill the empty shirts, or import your squad from a screenshot
              above.
            </div>
          )}

          <div className="panel px-4 py-3.5">
            {errors.length > 0 ? (
              <ul className="mb-3 space-y-1 text-[12.5px] text-amber-300">
                {errors.map((e) => (
                  <li key={e}>• {e}</li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-[12.5px] text-brand-400">
                Legal squad — {bench.length} on the bench, {starters.length} starting.
              </p>
            )}
            <button
              type="button"
              onClick={analyse}
              disabled={errors.length > 0}
              className="h-11 w-full rounded-lg bg-brand-500 text-[14px] font-bold text-pitch-950 transition enabled:hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Analyse this squad →
            </button>
            <p className="mt-2 text-[11.5px] leading-snug text-slate-500">
              {canPersist ? (
                <>
                  {saveState === "saving" && "Saving…"}
                  {saveState === "saved" && (
                    <span className="text-brand-400">
                      Saved automatically — this squad reopens next time you visit.
                    </span>
                  )}
                  {saveState === "error" && (
                    <span className="text-amber-300">
                      Could not autosave. Run the 0002 migration in Supabase if you have not
                      yet, then reload.
                    </span>
                  )}
                  {saveState === "idle" &&
                    "Edits are saved to your account automatically. Use Save current squad to keep a named copy."}
                </>
              ) : (
                "Sign in to have your squad saved automatically."
              )}
            </p>
          </div>
        </section>
      </div>

      {squad.length > 0 && (
        <section className="panel px-4 py-3.5">
          <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">
            Fixture runs
          </h3>
          <ul className="space-y-1">
            {squad.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 text-[12.5px]">
                <PositionBadge pos={p.pos} />
                <span className="w-32 truncate font-semibold text-white">{p.name}</span>
                <FixtureRun fixtures={p.fixtures} />
                <span className="num ml-auto text-slate-400">{p.xPts.toFixed(1)} pts</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}
