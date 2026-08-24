# FantasyTeamHub

[![CI](https://github.com/samuele-perrone/fantasy_team/actions/workflows/ci.yml/badge.svg)](https://github.com/samuele-perrone/fantasy_team/actions/workflows/ci.yml)

**Live: [fantasyteamhub.com](https://fantasyteamhub.com)**

A private Fantasy Premier League analytics site: points projections, player stats, fixture
analysis, transfer suggestions and squad building, built on the official FPL API — plus a
Claude-backed panel that answers questions about your own squad.

The site sits behind Google sign-in and an email allow-list, so only permitted accounts can
see anything.

```bash
npm install
vercel env pull          # Supabase keys + ALLOWED_EMAILS
npm run dev              # http://localhost:3000
```

## Documentation

- **[docs/RUNBOOK.md](docs/RUNBOOK.md)** — deploys, environment variables, Supabase, the
  domain switch, and what to do when something breaks
- **[docs/DECISIONS.md](docs/DECISIONS.md)** — why the model, optimiser and auth work the way
  they do, including the bugs that shaped them
- **[docs/MODEL.md](docs/MODEL.md)** — how projections are calculated, and their known limits

## Pages

Six pages, plus the player profile. The site was deliberately cut down from eighteen — see
[docs/DECISIONS.md](docs/DECISIONS.md) for what was folded in where.

| Route | What it does |
| --- | --- |
| `/` | Deadline countdown, best captain picks, best value, injury doubts |
| `/my-team` | Your squad — ratings, best XI, captaincy verdict, live score, chips, week-by-week history, and an **Ask about your squad** panel backed by Claude |
| `/transfers` | Ranked 1–3 transfer plans scored net of hits, plus a season-wide wildcard view |
| `/players` | Every player ranked, across five column groups (projection, season, attack, defence, market) |
| `/players/[id]` | Player profile — projections per fixture, underlying stats, gameweek history, past seasons |
| `/squad` | Build a squad by hand, import one from a screenshot, or auto-pick the best |
| `/fixtures` | Fixture difficulty ticker for all 20 clubs, with attacking and clean sheet views |
| `/scout` | Injuries, doubts and bans, captain shortlist, differentials and budget enablers |

Removed routes (`/predictions`, `/team-builder`, `/live`, `/planner`, `/compare`,
`/set-pieces`, `/guides`, `/match-centre`, `/prices`, `/leagues`) are kept as permanent
redirects in `next.config.ts` so old links and bookmarks still land somewhere useful.

## Architecture

```
src/lib/fpl/
  client.ts       Typed FPL API client — retries, and caches a trimmed bootstrap payload
  types.ts        Response types, narrowed to the fields actually read
  ratings.ts      Team strength recovery + Poisson expected goals model
  projection.ts   Per-player, per-fixture expected points
  news.ts         Parses injury news into per-fixture availability
  priors.json     Last season's per-90 rates, used while this season's sample is small
  row.ts          Flat PlayerRow DTO shared between server and client components
  data.ts         Request-deduped game data and player row assembly
  team-runs.ts    Team-level fixture runs for the fixture analyser
  optimiser.ts    Best-XI solver, squad optimiser and transfer planner
  entry.ts        Loads an FPL entry or a hand-built squad into one shape
  chips.ts        Chip names and their effect on scoring

src/lib/supabase/    Browser and server clients, plus squad/profile persistence
src/lib/auth/        Email allow-list
src/proxy.ts         Session refresh and the auth gate (Next 16 renamed middleware to proxy)
supabase/migrations/ Schema, applied through the Supabase SQL editor
```

Pages are React Server Components. Only the interactive tables, filters, builder and header
are client components. Nothing is statically prerendered — see
[docs/DECISIONS.md](docs/DECISIONS.md).

## Testing against a fixture server

`FPL_API_BASE` overrides the upstream API, which is useful when FPL is not serving what you
need — for example before the first deadline of a season, when no manager picks exist:

```bash
FPL_API_BASE=http://localhost:4555 npm run dev
```

## Notes

Data comes from the official Fantasy Premier League API. Projections are modelled in-house.
This project is not affiliated with or endorsed by the Premier League.
