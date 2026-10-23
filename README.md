# FantasyTeamHub

[![CI](https://github.com/samuele-perrone/fantasy_team/actions/workflows/ci.yml/badge.svg)](https://github.com/samuele-perrone/fantasy_team/actions/workflows/ci.yml)

**Live: [fantasyteamhub.com](https://fantasyteamhub.com)**

A Fantasy Premier League companion built around your own squad: every player gets a
keep, watch or sell verdict with the reason in one line, plus the transfers worth making and
a watchlist for the players you are tracking. Built on the official FPL API, with a
Claude-backed panel that answers questions about your squad. Web first; an iOS app follows
(see [docs/PLAN.md](docs/PLAN.md)).

The site sits behind Google sign-in and an email allow-list, so only permitted accounts can
see anything.

```bash
npm install
vercel env pull          # Supabase keys + ALLOWED_EMAILS
npm run dev              # http://localhost:3000
npm test                 # unit tests
```

## Documentation

- **[docs/PLAN.md](docs/PLAN.md)** — the rebuild into a Premier League app: scope, phases
  and what carries over from this site
- **[docs/RUNBOOK.md](docs/RUNBOOK.md)** — deploys, environment variables, Supabase, the
  domain switch, and what to do when something breaks
- **[docs/DECISIONS.md](docs/DECISIONS.md)** — why the model, optimiser and auth work the way
  they do, including the bugs that shaped them
- **[docs/MODEL.md](docs/MODEL.md)** — how projections are calculated, and their known limits

## Pages

Four tabs and the player profile. The previous six-page site is archived at the `v1-final`
tag; its routes now return 404.

| Route | What it does |
| --- | --- |
| `/` | Redirects to `/squad` |
| `/matches` | **Matches.** Every Premier League match in a gameweek, grouped by day, with arrows between gameweeks. A match opens to goals, assists, cards and bonus (worked out from BPS until FPL confirms it), and your squad and watchlist players are highlighted with their points. Refreshes every minute while a match is live |
| `/squad` | **My Squad.** Loads your FPL team from its ID; signed in, the team name opens your saved teams to switch between them. The captain and vice-captain for the next gameweek come first, then a link to `?view=wildcard`: the best squad the manager's money buys, against keeping theirs. Every player gets a verdict and a one-line reason; tapping opens the numbers, the news and, for Sell and Watch, the best replacements you can afford. |
| `/watchlist` | **Watchlist.** Suggested buys for this week, the players you have starred, each compared with the squad player they would replace, and a name search to add more |
| `/players` | **Players.** Every available player, filtered by position, club, maximum price and name, sorted by points over the next five, next game, form, season points, price or how many managers picked them. A star adds one to the watchlist; tapping opens the same numbers as My Squad |
| `/players/[id]` | Player profile: points per fixture, underlying stats, gameweek history, and a star to watch them |
| `/account` | The signed-in account: email, sign out, and delete the account with everything saved under it (asks twice). The header's person icon links here |
| `/privacy` | Privacy policy, public. Linked from App Store Connect, so it must match what the code collects |
| `/support` | Support page and common questions, public. Linked from App Store Connect |
| `/api/v1/squad` | My Squad as JSON, for the iOS app. Accepts a cookie session or `Authorization: Bearer` |
| `/api/v1/wildcard` | The wildcard view as JSON, for the iOS app. Same auth and `?id=` as `/api/v1/squad` |
| `/api/v1/account` | `DELETE` deletes the caller's account, for the app's Delete account |
| `/api/v1/players` | Players as JSON, with the page's filters as query parameters |
| `/api/v1/matches` | Matches as JSON. `?gw=` picks the gameweek |
| `/api/v1/watchlist` | Watchlist as JSON. `GET`, `POST {playerId}`, `DELETE ?playerId=` |
| `/api/v1/profile` | The FPL team shown on My Squad. `GET`, `PUT {entryId}` (adds it as a saved team) |
| `/api/v1/teams` | Saved teams. `GET` lists them and the active one; `POST {entryId}` adds one, checked with FPL; `PUT {entryId}` switches; `DELETE ?entryId=` forgets |

The iOS app lives in [`ios/`](ios/README.md): SwiftUI, reading the same `/api/v1`.

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
  verdict.ts      Keep / watch / sell, replacements and transfer suggestions
  matches.ts      Match reports, provisional bonus and per-match points from the live endpoint
  schedule.ts     European and cup fixtures per club, and three-games-in-seven-days runs
  optimiser.ts    Best-XI solver and transfer planner
  entry.ts        Loads an FPL entry into one shape
  chips.ts        Chip names and their effect on scoring

src/lib/app/         Server functions every page and /api/v1 route shares
src/lib/football/    European and cup fixtures from ESPN's public API, matched to FPL clubs
src/lib/supabase/    Clients, request auth (cookie or bearer), profile and watchlist
src/lib/auth/        Email allow-list
src/proxy.ts         Session refresh and the auth gate (Next 16 renamed middleware to proxy)
supabase/migrations/ Schema, applied through the Supabase SQL editor
```

The logo is three bars in the verdict colours, keep, watch and sell, which also read as an F.
Master app-icon artwork is in `public/brand/`; the favicon is `src/app/icon.svg`, the iOS
home-screen icon `src/app/apple-icon.tsx`, the header mark `components/logo.tsx`. The site has
light and dark themes, following the system setting until the header toggle overrides it.

Pages are React Server Components. Only the header, tab bar and the Matches tab's live
refresher are client components; rows expand with `<details>`, so they need no JavaScript. Nothing is statically prerendered — see
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
