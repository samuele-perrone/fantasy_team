# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev                      # dev server
npm run build                    # production build — also runs TypeScript
npx eslint src --max-warnings=0  # lint, exactly as CI runs it
npx tsc --noEmit                 # typecheck
npx next typegen                 # generate PageProps/LayoutProps route types
npm test                         # unit tests (Vitest), exactly as CI runs them
```

Model accuracy is measured by `scripts/backtest.mjs` — snapshots before a deadline, scored
after. **Run `npx tsx scripts/backtest.mjs score` after changing anything in `projection.ts`,
`ratings.ts` or `news.ts`** and check the error did not get worse.

Unit tests live beside the code as `*.test.ts` and run under Vitest (`vitest.config.mts`).
Build test data with `src/test/factories.ts` — `row()`, `squad()`, `element()`,
`bootstrap()` — stating only the fields the behaviour depends on. Use `copy(p, …)` rather
than `row({ ...p, … })`, which carries `p`'s fixtures over and silently ignores `perGame`.
`server-only` is aliased to a stub, and modules that touch Supabase, Next or the network are
mocked with `vi.mock`. **Add or update tests in the same change as the code.** A test is only
worth keeping if it fails when the rule it names is broken — break the code on purpose once
to check.

Unit tests use synthetic data, so they cannot say whether projections are *sensible*. For
that, still write a throwaway `.mts` script at the repo root and run it with `npx tsx`
against a real `bootstrap-static` snapshot, then delete it: squad legality across many real
squads, projection sanity for known players, constraint behaviour at tight budgets.

**`npx tsc --noEmit` passes locally but fails in CI on a clean checkout** unless
`npx next typegen` has run — `PageProps` and `LayoutProps` are globals Next emits into
`.next/types` and `next-env.d.ts`, both gitignored. TypeScript's incremental cache can also
mask this locally.

## Keeping documentation current

`README.md`, `docs/RUNBOOK.md`, `docs/DECISIONS.md` and `docs/MODEL.md` are the project's
memory across sessions. **Update them in the same change as the code**, not afterwards:

- new or removed route → README page table (and a redirect in `next.config.ts` if removed)
- anything operational (env vars, schema, domains, deploy behaviour) → RUNBOOK
- a non-obvious choice, or a bug whose fix would look like dead weight later → DECISIONS
- a change to how projections are calculated, or a new limitation → MODEL

## Architecture

### Data flow

`client.ts` (FPL API, cached) → `data.ts` (request-deduped) → `projection.ts` (expected
points per player per fixture) → `row.ts` (`PlayerRow`, the flat DTO every page and client
component consumes) → `optimiser.ts` for anything that picks a squad.

`PlayerRow` is the seam between server and client. Server components hold `FplElement`;
everything crossing into a client component is a `PlayerRow`.

### Pages

Three tabs (`/matches`, `/squad`, `/watchlist`) and the player profile, built mobile first for the iOS app
that follows — see `docs/PLAN.md`. Before adding a page, check whether it is a section of one
of the tabs: the previous site grew to eighteen pages because every idea got its own.

Matches (`src/lib/fpl/matches.ts`) reads FPL's fixtures and live endpoints through a 60-second
shared cache, and the page refreshes itself only while a match is live. Never poll FPL from the
browser or add a background poller: the cache is what keeps FPL's load flat as users grow.

Pages and the `/api/v1` routes share the server functions in `src/lib/app/`. Logic goes there,
not in a page, so the iOS app can read the same thing. `/api/v1` is exempt from the proxy's
login redirect and every route must call `getRequestAuth` itself.

### Auth and gating

`src/proxy.ts` (Next 16's rename of middleware) refreshes the Supabase session **and** gates
the whole site. Two rules it exists to enforce:

- cookies set during the refresh must be copied onto any redirect response, or the session is
  dropped and sign-in loops
- a valid session is not sufficient — the email must be on `ALLOWED_EMAILS`, enforced here
  and again in `getUserId()`

Because everything is gated, `curl` returns 307 on every page. To verify rendering locally,
add `""` to `PUBLIC_PREFIXES` — the match is `pathname === p || pathname.startsWith(`${p}/`)`,
so an empty prefix opens everything while `"/"` only matches the home page. Back the file up
first, restore it from the backup afterwards, and grep to confirm no bypass remains before
committing.

### Projections

Read `docs/MODEL.md` before touching `projection.ts`, `ratings.ts` or `news.ts`. The parts
most likely to be broken by a well-meaning change:

- `priors.json` is last season's per-90 rates, and carries the model through the early season
  when FPL has reset every stat. Refresh it each season from a pre-rollover snapshot.
- availability is resolved **per fixture**, not once per player
- a match counts as played on `finished_provisional` or `started && minutes >= 90`, because
  `finished` flips long after the whistle

### Optimiser

Verdicts (`verdict.ts`) are the user-facing layer: keep/watch/sell against the best affordable
replacement over five gameweeks, settled as one plan.

`optimiseSquad` maximises `XI xPts + benchWeight × bench xPts` subject to quota, budget and
club limits. Filters relax one at a time rather than returning nothing, and the result reports
what was given up. `bestXI` takes an optional fixed formation.

## Conventions

- Server components by default; `"use client"` only for genuine interactivity
- **The interface speaks football, not model.** `xPts`, `xMins`, `FDR`, `BPS`, "composite",
  "calibration" are code and docs vocabulary — user-visible `label`, `title` and prose say
  "Points", "Minutes", "Difficulty", "Chance of starting". Note that `key`, `metric` and
  `defaultSort` props hold `keyof PlayerRow` and must keep the field names; renaming those
  silently renders nothing (TypeScript catches it, so never skip `npx tsc --noEmit`).
- Simplifying language must not inflate confidence — the retrospective-estimate caveat and the
  ~1.6 points-per-player error margin are load-bearing and stay, in plainer words
- Tailwind v4, theme tokens defined in `globals.css` (`pitch-*`, `brand-*`, `accent-*`,
  `fdr-*`), plus `panel` and `num` utilities
- Comments explain *why*, especially where code guards against a specific FPL API behaviour
- Schema changes go in `supabase/migrations/`, written idempotently, and are applied through
  the Supabase SQL editor
