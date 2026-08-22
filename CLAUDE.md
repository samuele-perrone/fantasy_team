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
```

There is no test suite. Model and optimiser changes are verified by writing a throwaway
`.mts` script at the repo root and running it with `npx tsx`, against a real
`bootstrap-static` snapshot rather than fixtures. Delete the script afterwards. Examples of
what to check: squad legality (2/5/5/3, three-per-club, budget), projection sanity for known
players, and constraint behaviour at tight budgets.

**`npx tsc --noEmit` passes locally but fails in CI on a clean checkout** unless
`npx next typegen` has run — `PageProps` and `LayoutProps` are globals Next emits into
`.next/types` and `next-env.d.ts`, both gitignored. TypeScript's incremental cache can also
mask this locally.

## Keeping documentation current

`README.md`, `docs/RUNBOOK.md`, `docs/DECISIONS.md` and `docs/MODEL.md` are the project's
memory across sessions. **Update them in the same change as the code**, not afterwards:

- new route or tool → README route table
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

### Auth and gating

`src/proxy.ts` (Next 16's rename of middleware) refreshes the Supabase session **and** gates
the whole site. Two rules it exists to enforce:

- cookies set during the refresh must be copied onto any redirect response, or the session is
  dropped and sign-in loops
- a valid session is not sufficient — the email must be on `ALLOWED_EMAILS`, enforced here
  and again in `getUserId()`

Because everything is gated, `curl` returns 307 on every page. To verify rendering locally,
temporarily neuter the redirect in `proxy.ts`, then restore it from git and confirm no bypass
remains before committing.

### Projections

Read `docs/MODEL.md` before touching `projection.ts`, `ratings.ts` or `news.ts`. The parts
most likely to be broken by a well-meaning change:

- `priors.json` is last season's per-90 rates, and carries the model through the early season
  when FPL has reset every stat. Refresh it each season from a pre-rollover snapshot.
- availability is resolved **per fixture**, not once per player
- a match counts as played on `finished_provisional` or `started && minutes >= 90`, because
  `finished` flips long after the whistle

### Optimiser

`optimiseSquad` maximises `XI xPts + benchWeight × bench xPts` subject to quota, budget and
club limits. Filters relax one at a time rather than returning nothing, and the result reports
what was given up. `bestXI` takes an optional fixed formation.

## Conventions

- Server components by default; `"use client"` only for genuine interactivity
- Tailwind v4, theme tokens defined in `globals.css` (`pitch-*`, `brand-*`, `accent-*`,
  `fdr-*`), plus `panel` and `num` utilities
- Comments explain *why*, especially where code guards against a specific FPL API behaviour
- Schema changes go in `supabase/migrations/`, written idempotently, and are applied through
  the Supabase SQL editor
