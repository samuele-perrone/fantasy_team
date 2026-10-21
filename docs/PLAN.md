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

## Who it is for

A handful of invited users to start, then anyone. **Build for everyone from the start:**
accounts, data and costs must work for users who are not on a list. The email allow-list
stays as an invite gate until the app opens up, and opening up should mean switching it off,
not rewriting sign-in.

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
| **My Squad** | Your FPL team, loaded from your team ID. Each player shows one verdict (keep, watch or sell) and a sentence giving the reason. Form, expected points, minutes, upcoming matches across all competitions and the latest news sit behind an (i) icon. An **Ask about your squad** button opens the AI panel. |
| **Watchlist** | A "Suggested this week" section of players worth buying, then the players you have marked, each shown next to the squad player they would replace. |
| **Player page** | Form, recent matches, next fixtures including Europe and cups, expected points per fixture. |

Before adding a fourth tab, check whether it fits as a section of one of these three.

## Verdicts

Every squad player is compared with **the best replacement the manager can afford in the same
position**: the selling price plus money in the bank, without breaking the three-per-club
limit. It is the same calculation that produces transfer suggestions, so a Sell verdict and
the replacements offered under it always agree.

The comparison covers **the next five gameweeks**, nearer ones weighted more, matching the
horizon the transfer planner already uses.

| Verdict | When |
| --- | --- |
| **Sell** | The replacement is expected to score 5+ points more over the five gameweeks (about one a week), or the player is ruled out of the next two gameweeks or longer |
| **Watch** | The gap is 2–5 points, or there is a fitness doubt (50–75% chance of playing), or the club plays three games in seven days |
| **Keep** | Otherwise |

- **5 points is a starting value, not a fitted one.** The model's error is about 1.6 points
  per player per gameweek, so a smaller gap over five weeks is not clearly real. Tune it
  against real squads in phase 1a.
- **Sells are capped at the manager's free transfers.** Beyond that, a Sell must pass the
  existing hit rule (a −4 transfer must clear the hit by another 4 points, see
  [DECISIONS.md](DECISIONS.md)), or it is shown as Watch. The screen never asks for five
  transfers when the manager has one.
- **The sentence names the factor that decided the verdict:** "Three games in seven days",
  "Out until November", "Two easy home games".
- Verdicts are computed in code and never by the AI panel.

## Data sources

| Source | Covers | Cost |
| --- | --- | --- |
| FPL API | Squads, prices, form, news, Premier League fixtures, live goals/assists/bonus/minutes | Free |
| API-Football, free tier | European and cup fixtures for Premier League clubs, fetched once a day | Free |
| API-Football, paid plan | Line-ups, minute-by-minute events, player match ratings | Paid, from phase 3 only |

Sofascore has no public API and scraping it would breach its terms, so it is not a source.

**Start on API-Football's free tier and see how it goes.** Two things to check on signing up:
the daily request limit, and whether the free tier serves the current season at all, since it
has at times been limited to past seasons. If it does not, revisit before building phase 1b
on it.

## Phases

### Phase 1a: My Squad and Watchlist, on the current model

**Status: built, on branch `rebuild/phase-1a`.** Not yet built: the Watch rule for three games
in seven days, which needs the phase 1b fixtures. The old squad builder's manual entry, which
let a manager rate transfers FPL has not published yet, was removed with it.

The part of the app nobody else offers, and the part the old site made hardest to use. Built
on the model as it stands, so it is usable within days.

- **Replace the old site, including its database.** It is no longer used. Delete the six
  pages, their components and the legacy redirects, and replace the Supabase tables with the
  new schema. Export the old tables before dropping them, as a precaution.
- Enter an FPL team ID once and load the squad from the public entry endpoint. No FPL login.
- Verdicts as described above, each with one plain sentence on the row and an (i) icon for
  the numbers behind it: expected points, minutes, form, fixture load, and the latest news
  with the time it was published.
- News comes from FPL's own news field, which FPL updates after press conferences. Its time
  matters as much as its text, because a two-day-old "75% chance" may already be stale.
- A watchlist stored per user in Supabase.
- Transfer suggestions, in two places, both from the verdict calculation:
  - **From a Sell verdict.** Tapping a player marked Sell lists the best three replacements
    in that position.
  - **Suggested this week,** at the top of the Watchlist: the best buys across all
    positions, even when nobody in the squad is marked Sell, so a rising player is caught
    before the price moves. A star moves a suggestion into the watched list.
  - Each suggestion gets the same one-sentence reason and (i) panel as a squad player. The
    points cost of extra transfers goes in the (i) panel, not the row.
- The AI panel, behind a button on My Squad.

**Done when** the squad and watchlist work on a phone, and the verdicts and suggestions make
sense against known players.

### Phase 1b: European and cup fixtures in the model

- Fetch fixtures daily from API-Football for every Premier League club in the Champions
  League, Europa League, Conference League, FA Cup and EFL Cup, and map clubs to FPL team IDs.
  The point is fixture load: a player who starts every match in a congested run is the one
  who gets rested, and that is what the minutes model needs to see.
- Feed midweek fixtures into the minutes model as rotation risk. This fixes the "Rotation is
  invisible" limit in [MODEL.md](MODEL.md).
- Show the extra fixtures on the player page and in the (i) panel.

**Done when** the backtest error has not got worse, and ideally has improved for players at
clubs in Europe.

### Phase 2: Matches, on free data

- Fixtures and results for every Premier League match, grouped by gameweek.
- Live scores, scorers, assists, cards and bonus from the FPL live endpoint. Live data is
  cached for 60 seconds while a match is in play: the first request after that fetches
  fresh data, and every other user reads the cached copy. There is no background poller, so
  the request rate to FPL does not grow with the number of users, and nothing runs when
  nobody is looking.
- Your squad and watchlist players highlighted in every match.

**Done when** it is the screen you open during a matchday instead of another app.

### Phase 3: Live match detail, paid

Upgrade to the API-Football paid plan only once phases 1 and 2 are in daily use.

- Confirmed line-ups before kickoff, flagged against your squad.
- Minute-by-minute match timeline.
- Player match ratings, shown on the player page.

### Phase 4: iOS

- Choose between SwiftUI (more native feel) and Expo (reuses the TypeScript). Decide at the
  start of this phase, not before.
- The app consumes the same JSON API as the web version, so no logic is rewritten.
- Push notifications for goals, line-ups and price changes involving your players. See the
  open question on background work.

## Architecture

- **All logic behind JSON API routes** under `/api/v1/`, with pages calling the same functions
  on the server. The iOS app then needs nothing new from the backend.
- API routes check `getUserId()` themselves, as `/api/ask` does, because the proxy matcher does
  not cover them. The iOS app will need token auth instead of cookies; design for that in
  phase 1a rather than retrofitting it.
- **Sign-in must work for the App Store.** If the iOS app offers Google sign-in, Apple will very
  likely require Sign in with Apple alongside it. Supabase supports both; plan for both.
- Third-party responses are cached and trimmed before caching, as the FPL client already does.

## What carries over

**Kept:**
- `src/lib/fpl/`: the client, `projection.ts`, `ratings.ts`, `news.ts`, `priors.json`, `row.ts`,
  `entry.ts`, `rules.ts`
- `optimiser.ts`, whose transfer planner already does the calculation behind verdicts and
  suggestions
- `scripts/backtest.mjs` and the backtest workflow, which keep scoring the model throughout the
  rebuild
- Supabase auth, `proxy.ts` and the email allow-list (as the invite gate)
- The AI panel: `/api/ask`, `src/lib/ai/`, and the rule that the model explains but never
  calculates
- Vercel deploys, CI, `docs/RUNBOOK.md`, `docs/DECISIONS.md` and `docs/MODEL.md`

**Dropped, in phase 1a:**
- All six current pages and their components
- The squad builder and transfer planner pages. Their calculations stay in `optimiser.ts`.
- The ten legacy redirects in `next.config.ts`
- The current Supabase tables, after exporting them

## Open questions

- **Club-level or player-level fixture load.** Club fixtures are a few requests a day.
  Each player's minutes in European and cup matches costs one request per match, which may
  not fit the free tier. Start with club fixtures plus Premier League minutes, and measure
  whether player-level minutes improve the backtest before paying for them.
- **Press conference news beyond FPL's field.** FPL's news is a short injury flag, not what
  the manager said. A fuller source, such as club or BBC news feeds summarised into one
  sentence, would add context to the (i) panel. Decide after phase 1a whether FPL's field is
  enough.
- **Background work for notifications.** Goal and line-up alerts need something watching
  matches when nobody has the app open. Vercel's free plan runs scheduled jobs only once a
  day, so this needs a paid plan or another service. Decide before phase 4.
- **AI panel cost per user.** Every question is a paid API call. Once the app is open to
  everyone, it needs a per-user limit.
