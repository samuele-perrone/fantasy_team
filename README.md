# FantasyTeamHub

[![CI](https://github.com/samuele-perrone/fantasy_team/actions/workflows/ci.yml/badge.svg)](https://github.com/samuele-perrone/fantasy_team/actions/workflows/ci.yml)

**Live: [fantasyteamhub.com](https://fantasyteamhub.com)** (served from
`fantasyteam.vercel.app` until DNS is switched — see [docs/RUNBOOK.md](docs/RUNBOOK.md))

A private Fantasy Premier League analytics site: points projections, OPTA-style stats,
fixture analysis, price change predictions, transfer suggestions and a squad optimiser, built
on the official FPL API.

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

## Tools

| Route | What it does |
| --- | --- |
| `/` | Dashboard — deadline countdown, captain shortlist, value picks, differentials, market movement |
| `/predictions` | Projected points for every player over the next 1, 3, 5 or 8 gameweeks |
| `/players` | Every player ranked across five column groups (projection, season, attack, defence, market) |
| `/players/[id]` | Player profile — projections per fixture, underlying stats, gameweek history, past seasons |
| `/compare` | Up to four players side by side across 27 metrics |
| `/fixtures` | Fixture difficulty ticker for all 20 clubs, with separate attacking and clean sheet views |
| `/prices` | Predicted price risers and fallers tonight, plus season-long movement |
| `/match-centre` | Live scores, goalscorers and provisional bonus points |
| `/scout` | Injuries, doubts and bans linked to the club's press conference; predicted lineups |
| `/set-pieces` | Penalty, corner and free-kick takers for every club |
| `/squad` | Build a squad by hand, import one from a screenshot, or auto-pick the best |
| `/my-team` | Load your squad — ratings, optimal XI, captaincy verdict, gameweek-by-gameweek |
| `/transfers` | Ranked 1–3 transfer plans scored net of points hits, plus a wildcard draft |
| `/team-builder` | Squad optimiser for any budget, with lock-in and exclusion constraints |
| `/live` | Live gameweek points with provisional bonus, captain multipliers and chips |
| `/planner` | Eight-week projection for your squad with chip windows picked out |
| `/leagues` | Classic mini-league standings, movement and awards |
| `/guides` | Scoring rules, chip strategy, blank/double gameweeks, price changes, underlying stats |

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
