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

Model accuracy is measured by `scripts/backtest.mjs` — snapshots before a deadline, scored
after. **Run `npx tsx scripts/backtest.mjs score` after changing anything in `projection.ts`,
`ratings.ts` or `news.ts`** and check the error did not get worse.

There is no unit test suite. Model and optimiser changes are otherwise verified by writing a throwaway
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

There are six pages plus the player profile; ten earlier routes are permanent redirects in
`next.config.ts`. Before adding a page, check whether it is a column, a sort or a section on
one of the six — the last cut existed because the site had a page per idea.

### The AI panel

`/api/ask` streams Claude through the Anthropic API (`ANTHROPIC_API_KEY`). Three rules:

- **the model explains, it never calculates.** `src/lib/ai/squad-brief.ts` hands it conclusions
  already computed by `optimiser.ts` and `projection.ts`, so the chat cannot contradict the
  page. Adding a number the model derives itself breaks that guarantee.
- **the route re-checks `getUserId()`** — the proxy matcher does not cover API routes, and
  every call costs money
- **the model is pinned** in `src/lib/ai/model.ts`, overridable by `FTH_AI_MODEL`. The Vercel
  AI Gateway was tried first and dropped: it needs no key, but serves models by Vercel plan,
  and a free plan gives `claude-3-haiku` at roughly one request every few minutes.

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
