# Plan: the Premier League app

The six-page analytics site is archived at the `v1-final` tag. This is the plan for what
replaces it: a Premier League companion built around your own FPL squad, web first and iOS
once the web version is right.

## Why restart

The old site worked, but it was hard to follow. It answered every question FPL raises, each
on its own page, and the manager had to know where to look. The new app starts from two
questions instead:

- **What is happening in the Premier League right now?**
- **What does it mean for my squad, and for the players I am watching?**

Anything that does not help answer one of those is out of scope.

## Principles

- **Premier League only.** All 20 clubs, every match. Other competitions appear only as
  fixtures that affect Premier League players: European and cup matches that cause rotation.
- **Your squad first.** Your players are highlighted everywhere: in live scores, match
  details and fixture lists.
- **One recommendation, not a dashboard.** Each player gets one clear verdict, with the
  numbers behind it a tap away rather than all on screen.
- **Mobile first.** The web version is designed for a phone screen from day one, because
  the iOS app will copy its layout.
- **The interface speaks football, not model.** The same rule as before (see CLAUDE.md).

## The app

Three tabs, plus a player page reachable from all of them.

| Tab | What it shows |
| --- | --- |
| **Matches** | Fixtures and live scores for every Premier League match. A match opens to the scorers, assists, cards and bonus, with your players highlighted. |
| **My Squad** | Your FPL team, loaded from your team ID. Each player shows their next matches across all competitions, form, expected points and one verdict: keep, watch or sell. |
| **Watchlist** | A "Suggested this week" section of players worth buying, then the players you have marked, each shown next to the squad player they would replace. |
| **Player page** | Form, recent matches, next fixtures including Europe and cups, expected points per fixture. |

Before adding a fourth tab, check whether it fits as a section of one of these three.

## Data sources

| Source | Covers | Cost |
| --- | --- | --- |
| FPL API | Squads, prices, form, Premier League fixtures, live goals/assists/bonus/minutes | Free |
| API-Football, free tier | European and cup fixtures for Premier League clubs, fetched once a day | Free |
| API-Football, paid plan | Line-ups, minute-by-minute events, player match ratings | Paid, from phase 3 only |

Sofascore has no public API and scraping it would breach its terms, so it is not a source.

Check the API-Football free tier's daily request limit when signing up. Daily fixture fetches
for five or six competitions should fit comfortably, but that is an assumption until it is
measured.

## Phases

### Phase 1: My Squad and Watchlist

The part of the app nobody else offers, and the part the old site made hardest to use.

- Enter an FPL team ID once and load the squad from the public entry endpoint. No FPL login.
- Fetch fixtures daily from API-Football for every Premier League club in the Champions
  League, Europa League, Conference League, FA Cup and EFL Cup, and map clubs to FPL team IDs.
  The point is fixture load: a player who starts every match in a congested run is the one
  who gets rested, and that is what the minutes model needs to see.
- Feed midweek fixtures into the minutes model as rotation risk. This fixes the "Rotation is
  invisible" limit in [MODEL.md](MODEL.md), and has to be backtested like any other model
  change.
- A watchlist stored per user in Supabase.
- Transfer suggestions, in two places, both from the same calculation:
  - **From a Sell verdict.** Tapping a player marked Sell lists the best three replacements
    in that position.
  - **Suggested this week,** at the top of the Watchlist: the best buys across all
    positions, even when nobody in the squad is marked Sell, so a rising player is caught
    before the price moves. A star moves a suggestion into the watched list.
- Suggestions only include players the manager can afford (the selling price plus money in
  the bank) without breaking the three-per-club limit. Each gets the same one-sentence reason
  and (i) panel as a squad player. The points cost of extra transfers goes in the (i) panel,
  not the row.
- One verdict per player (keep, watch or sell), computed in code and never by the AI panel.
  The row shows the verdict and one plain sentence giving the reason. An (i) icon opens the
  numbers behind it: expected points, minutes, form, fixture load, and the latest news with
  the time it was published.
- News comes from FPL's own news field, which FPL updates after press conferences. Its time
  matters as much as its text, because a two-day-old "75% chance" may already be stale.

**Done when** the squad and watchlist work on a phone, the verdicts and suggestions make
sense against known players, and the backtest error has not got worse.

### Phase 2: Matches, on free data

- Fixtures and results for every Premier League match, grouped by gameweek.
- Live scores, scorers, assists, cards and bonus from the FPL live endpoint. The server
  fetches once a minute, only while a match is in play, and every user reads that cached
  copy, so the request rate to FPL does not grow with the number of users.
- Your squad and watchlist players highlighted in every match.

**Done when** it is the screen you open during a matchday instead of another app.

### Phase 3: Live match detail, paid

Upgrade to the API-Football paid plan only once phases 1 and 2 are in daily use.

- Confirmed line-ups before kickoff, flagged against your squad.
- Minute-by-minute match timeline.
- Player match ratings, shown on the player page as form.

### Phase 4: iOS

- Choose between SwiftUI (more native feel) and Expo (reuses the TypeScript). Decide at the
  start of this phase, not before.
- The app consumes the same JSON API as the web version, so no logic is rewritten.
- Push notifications for goals, line-ups and price changes involving your players.

## Architecture

- **All logic behind JSON API routes** under `/api/v1/`, with pages calling the same functions
  on the server. The iOS app then needs nothing new from the backend.
- API routes check `getUserId()` themselves, as `/api/ask` does, because the proxy matcher does
  not cover them. The iOS app will need token auth instead of cookies; design for that in
  phase 1 rather than retrofitting it.
- Third-party responses are cached and trimmed before caching, as the FPL client already does.

## What carries over

**Kept:**
- `src/lib/fpl/`: the client, `projection.ts`, `ratings.ts`, `news.ts`, `priors.json`, `row.ts`,
  `entry.ts`, `rules.ts`
- `optimiser.ts`, whose transfer planner already does the calculation behind suggestions
- `scripts/backtest.mjs` and the backtest workflow, which keep scoring the model throughout the
  rebuild
- Supabase auth, `proxy.ts` and the email allow-list
- The AI panel: `/api/ask`, `src/lib/ai/`, and the rule that the model explains but never
  calculates
- Vercel deploys, CI, `docs/RUNBOOK.md`, `docs/DECISIONS.md` and `docs/MODEL.md`

**Dropped:**
- All six current pages and their components
- The squad builder and transfer planner pages. Their calculations stay in `optimiser.ts`.
- The ten legacy redirects in `next.config.ts`

## Open questions

- **Club-level or player-level fixture load.** Club fixtures are a few requests a day.
  Each player's minutes in European and cup matches costs one request per match, which may
  not fit the free tier. Start with club fixtures plus Premier League minutes, and measure
  whether player-level minutes improve the backtest before paying for them.
- **Press conference news beyond FPL's field.** FPL's news is a short injury flag, not what
  the manager said. A fuller source, such as club or BBC news feeds summarised into one
  sentence, would add context to the (i) panel. Decide after phase 1 whether FPL's field is
  enough.
