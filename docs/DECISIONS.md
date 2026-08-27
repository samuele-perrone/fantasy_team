# Decisions

Why things are the way they are. Most entries exist because something broke first — those are
worth reading before "simplifying" the code they describe.

## Data

### The bootstrap payload is trimmed before caching

`bootstrap-static` serialises to ~2.1MB, over Next's 2MB data-cache limit, so caching the raw
response silently failed and every request refetched it. FPL returns ~109 fields per player
and the app reads 54, so `client.ts` constructs trimmed objects before `unstable_cache` stores
them: 1.51MB → 0.69MB.

Types alone could not fix this. TypeScript is erased at runtime, so narrowing the interface
changed nothing — the trim has to build the objects explicitly.

### No static prerendering

`export const dynamic = "force-dynamic"` in the root layout. Every route is behind the login
gate, so static generation bought nothing, while making each deploy depend on FPL answering
during the build. Rendering 28 pages across parallel workers fired concurrent bootstrap
requests — React's cache dedupes per request, not across processes — FPL rate-limited them,
and one 403 failed the whole deploy.

Rendering per request costs about 5ms of projection maths for all 599 players, measured. The
FPL fetch itself is still cached.

### Requests retry with backoff

403, 408, 425, 429 and 5xx retry with exponential backoff and jitter. A 404 fails immediately,
since retrying cannot help.

## Model

### Last season's rates are committed as a prior

`priors.json` holds per-90 rates for 331 players from the previous season. FPL wipes every
season stat at the rollover, so for the first months of a season the live per-90 rates are
computed from a handful of minutes, or none at all.

Without this, after gameweek one, B.Fernandes projected **1.77 points** because his club had
not kicked off, so his xG, xA and bps were all zero. The prior is worth about six matches and
shrinks away as real data accumulates.

**Refresh it at the start of each season** from a pre-rollover snapshot of `bootstrap-static`,
before FPL resets the stats. Once they are reset the source data is gone.

### A played match counts before it is marked finished

`teamGames` counts `finished || finished_provisional || (started && minutes >= 90)`. The
`finished` flag flips well after the whistle — Arsenal v Coventry was played, 90 minutes, 3-0,
and still `finished: false`. Counting only `finished` left the sample at zero, and a fallback
then treated every starter as having played 1 of 38 games. Calafiori scored 9 points and came
out rated 0.5.

### Availability is per fixture, not per player

An injury with "Expected back 23 Aug" rules out fixtures before that date and nothing after.
A published chance of playing applies to the next round and eases back afterwards. A
suspension costs one match. Previously a single multiplier was applied across the whole
horizon, so a knock cost a quarter of a player's minutes in every gameweek and "back on 23
Aug" was treated identically to "back on 28 Nov".

### Recent signings are discounted

A summer signing carries a full season of starts from a different club. `team_join_date` is
used to shrink their observed start rate toward the price prior, fading out over 150 days.
Senesi went from 90% to 76% likely to start at Tottenham on the back of Bournemouth minutes.

### What the model cannot see

FPL marks a player unavailable only **after** a transfer completes. A rumoured or
agreed-but-unannounced move is invisible — the player reads as fully fit. Hence the manual
exclusion list in the squad builder. No amount of modelling recovers this.

Similarly, press conference detail about *fit* players ("he'll be rotated") is not in the API.
`scout_news_link` exists only for players already flagged, and is surfaced on `/scout` as a
citation rather than as new signal.

### Squad rules are read from FPL

`SQUAD_QUOTA`, `TEAM_LIMIT` and the £100m budget were hardcoded in four places, duplicated
between the optimiser and the builder, and quietly bet on the rules never changing. They do:
recent seasons added the defensive contribution point, the Assistant Manager chip and a
five-transfer rollover cap.

`rules.ts` now derives them from `game_settings` and `element_types`, which meant restoring
those blocks to the cached payload. Legal formations are generated from the published
positional minimums rather than a hardcoded list. `DEFAULT_RULES` is the fallback and the
single definition the optimiser's constants derive from, so the two cannot disagree.

The rules are threaded all the way through the solver — `bestXI`, the greedy sweep, the
budget reserve, the cheapest-legal fallback, the local search and the transfer planner all
take them as a parameter rather than reading module constants. Verified by solving against
hypothetical rule sets: a 16-man squad with three keepers, a ten-a-side XI, a four-per-club
limit and a £110m budget all produce legal squads matching those rules.

`ruleDrift()` compares live rules against what the app was built for, and the squad page
notes any difference. Since the solver follows the live rules, that notice is informational
rather than a warning that output is wrong.

## Optimiser

### Greedy sweep plus local search

Squad selection is a knapsack with quota, budget and three-per-club constraints. It runs a
Lagrangian-style greedy sweep over price penalties, then steepest-ascent single-player swaps.
About 10ms for the full pool.

### The budget reserve is per position

The greedy originally reserved a flat £4.0m per unfilled slot. Positions have very different
price floors, so on a tight budget it rejected affordable picks and failed to fill 15 at all —
£83.5m returned no squad whatsoever. It now reserves the sum of the cheapest players actually
needed per position, a true lower bound. £83.5m went from nothing to 200.9 projected points.

A cheapest-legal fallback seeds the search if every price penalty still fails.

### Auto-pick preferences relax rather than fail

Filters are dropped one at a time, hardest first, and the result names what was given up.
Asking for FDR 1 with 97% starters still returns a squad.

Two requested filters could not be built literally. Expected minutes are probability-weighted
and peak at 76 across the whole game, so an "80 minutes" filter matches nobody — it is
expressed as a chance of starting. And no goalkeeper and only two defenders take penalties, so
requiring penalty takers cannot fill a legal squad — it is a scoring bonus instead.

### Chips are tracked per half-season

FPL issues a full set of chips for gameweeks 1–19 and another for 20–38. An unused first-half
chip is lost at gameweek 19 rather than rolling over, which is the most expensive thing a
manager can forget, so expiry is tracked explicitly. Wildcard and Free Hit act on transfers
and cannot be played in gameweek one, when transfers are already unlimited.

Chips already played are read from the entry's history and shown as spent; recommendations
cover only what is left.

### The Wildcard is timed across the season, not the horizon

Wildcard timing originally searched the visible eight gameweeks and returned the weakest week
in that window, which on a real entry meant recommending GW9 for a dip that was ordinary.
Fixtures are published for the whole season and projecting all of it costs 10ms, so the
search now covers every remaining gameweek and scores each candidate by the five-week run
that follows it, clipped to the chip's own half-season window.

Beyond roughly eight weeks this is effectively a fixture-difficulty read — form and injury
news do not reach that far — which is the right signal for Wildcard timing but is not a
points forecast, and the page says so.

The result is usually "hold": a fifteen-man squad drawn from many clubs averages fixture
swings away, so the season-long spread on a balanced squad is only a couple of points a week.
A weak signal reported as weak is more useful than a confident pick from noise.

### Hits need a margin, not just a positive net gain

Recommending the plan with the highest net gain meant recommending two hits, −8 points
certain, for a projected edge of 2.65 points over five gameweeks — about 0.5 a gameweek
spread across three swapped players. The model's measured error is 1.57 points per player per
gameweek, so the claimed edge was far smaller than the error on any one of them.

A plan taking hits is now only recommended when it beats the best hit-free plan by more than
the hits cost again: one hit must clear by 4 points, two by 8. Aggressive plans are still
shown, labelled "not worth the hit" with the reasoning on hover, rather than hidden.

## Auth

### The allow-list fails closed

Google sign-in accepts any Google account, so a valid session is not enough. `ALLOWED_EMAILS`
gates access, and an unset list denies everyone rather than quietly opening the site up. The
login page explains that case so a misconfiguration is recoverable.

Enforced in the proxy **and** in `getUserId`, so a route outside the proxy's matcher cannot
hand data to a denied account.

### Refreshed cookies must survive redirects

The proxy refreshes the Supabase session, and those cookies have to be copied onto any
redirect response. Without that the refreshed session is dropped and the user bounces between
`/login` and their destination forever.

### `getClaims`, never `getSession`

`getClaims()` verifies the JWT signature. `getSession()` returns whatever is in the cookie
without validating it, so it must never gate access to data.

### Icons are public paths

`/icon` and `/apple-icon` have no file extension for the proxy matcher to skip, so the gate
was redirecting them and iOS could not fetch the home-screen icon.

## UI

### The builder autosaves

Squad state was React-only, so a refresh discarded it — and the footer claimed the squad
"lived in the URL", which was only true after pressing Analyse. Edits now autosave, debounced,
into a reserved draft row. Migration `0002` relaxed the exactly-fifteen constraint to at most
fifteen, because a squad being built is incomplete by definition.

### Autoloading removes entry points

Twice now, adding a convenient autoload has hidden a control: `/my-team` loading a saved squad
removed the team-ID form, and before that the saved-squad list was only on `/squad`. When
adding an autoload, check what the user can no longer reach.

### Eighteen pages became six

The site had grown a page per idea, and the result was a menu that had to be studied rather
than read. Two problems compounded: the same player table appeared under four different
names, and the answer to "what should I do this week?" was spread across `/my-team`, `/live`
and `/planner`.

The cut is by question asked, not by feature removed:

| Was | Now |
| --- | --- |
| `/live`, `/planner`, chip timing, season history | folded into `/my-team` |
| `/predictions`, `/compare`, `/set-pieces`, `/prices` | columns and sorts on `/players` |
| `/team-builder` | the auto-pick already on `/squad` |
| `/match-centre` | fixture detail on `/fixtures` |
| `/leagues`, `/guides` | dropped — neither answered a team decision |

Everything removed is a permanent redirect in `next.config.ts`. Nothing was deleted from
`src/lib`, so the model, optimiser and simulation are untouched.

### The interface stopped speaking in model terms

`xPts`, `xMins`, `FDR`, `BPS`, "composite rating", "calibration check" — the UI had been
written in the vocabulary of the code behind it. These now read as "Points", "Minutes",
"Difficulty", "Starts?" and plain sentences.

Two rules came out of doing it:

- **Field names are not labels.** A bulk rename of `"xPts"` also hit `key: "xPts"` and
  `metric="xPts"`, which index `PlayerRow`. Those are identifiers and must keep their names;
  only the rendered `label`/`title` changes. TypeScript caught it — `keyof PlayerRow` is what
  made the mistake visible rather than silently rendering `undefined`.
- **Keep the honest caveats, drop the vocabulary.** The retrospective-estimate warning and the
  1.6-points-per-player error margin both stayed, reworded. Simplifying the language must not
  quietly upgrade how confident the app sounds.

The technical terms remain in `docs/` and throughout `src/lib` — that is where they belong.

### A second language pass, from the rendered page

The first pass removed the vocabulary — `xPts`, `FDR`, `BPS`. Reading the *rendered* text
afterwards showed the sentences were still written for someone who already knew the model:
"cheap enablers", "minutes security", "the median regular starter", "treat it as a data
prior", "the largest lever on a big week".

Grepping the source finds terms; it does not find dense writing. What worked was dumping the
visible text of every page — including `title` attributes, where the worst offenders were
hiding — and reading it as prose. That is also how the stale "send the squad through the
ratings, transfer and planner tools" line on `/squad` surfaced, three weeks after `/planner`
was deleted.

Rewrites kept every caveat and every number. "Nobody scores 10 because your bench drags the
average down" says exactly what "cheap enablers cap the composite near 6.5" said.

### The AI panel explains; it does not calculate

The obvious way to build "ask about your squad" is to hand the model the raw data and let it
reason. That was rejected: an LLM doing arithmetic over 15 players would sooner or later print
a number that disagreed with the number next to it on the page, and the whole site's credibility
rests on those numbers being consistent.

So `squad-brief.ts` ships **conclusions, not just data** — the best XI, the captaincy gap, the
ranked transfer plans with their hit costs already netted off, the chip windows. The model's
job is to select, compare and explain, which is what it is good at.

This was worth doing carefully. Testing on `claude-3-haiku`, the question *"is it worth a -4 to
bring in Welbeck?"* got the answer "yes, the -4 is worth it" — when that transfer is **free**,
because the manager had a free transfer and the brief said `hit 0`. The model had accepted the
false premise in the question instead of checking. The brief now spells out the free-transfer
count and annotates every plan as `FREE, no points deducted` or `costs N points`, and the
system prompt has an explicit rule about correcting false premises.

That failure is also an argument for the model tier mattering: a weak model will take the
question's word for things a stronger one checks.

### Anthropic directly, not the Vercel AI Gateway

The panel was built on the gateway first, because it needs no key — the deployment's OIDC
token authenticates it. That is genuinely the lowest-friction option and it worked.

It was replaced because the gateway serves models by **Vercel plan**. On a free plan that
meant `claude-3-haiku` only, rate-limited to about one request every few minutes. Both limits
are invisible in the code and unfixable from it.

An earlier version tried to cope by resolving the model at runtime — walking a candidate list
and caching whichever the gateway would serve. That was the right shape for the gateway's
constraint, and it is now dead weight: an Anthropic key has no tier gate, so the model is
simply pinned and overridable by `FTH_AI_MODEL`. Deleting the probe also removed its worst
property, which was spending a request to discover it had no requests to spare.

### Order the error branches by specificity, not by likelihood

The gateway's rate-limit message reads *"Free tier requests on this model are rate-limited.
Upgrade to paid credits…"*. The handler tested for credit/billing wording first, so a
transient rate limit — wait ten seconds — was reported to the manager as *"add credits"*. They
went and looked at their billing page because of it.

Any message matching several branches must be tested against the narrowest one first.

### The brief must describe incoming players as fully as owned ones

The first version of `squad-brief.ts` rendered the manager's own 15 in full — minutes, start
chance, rating, injury news — and rendered transfer targets as `Name (£6.0m)`.

The result was an assistant that recommended signing Welbeck and, when told he was not
playing, replied *"I don't have injury or team news on Welbeck, so I can't confirm that"*. The
site did have it: he was flagged doubtful at 75%, with 0 starts and 0 minutes. Nobody had
passed it along.

An LLM cannot reason about what it was not sent. Any player the brief *names* now carries the
same detail, and the prompt forbids claiming ignorance about anyone who appears in it.

Season starts and minutes were added at the same time, because a projection alone cannot
answer "has he actually been playing?" — a player with no minutes can still project well on
last season's rates via `priors.json`, which is exactly the case that caused the complaint.

### The brief describes matches, not just players

The first briefs were a list of players with projections attached. Asked "who should I move
on?", the assistant could answer; asked anything about the football — who is favourite, who is
most likely to score — it had nothing to work with, because none of that reached it.

`matchContext()` now groups the manager's players by the fixture they are actually in, and
gives each match a favourite and an expected-goals line, each player a goal/assist/clean-sheet
chance, and the week a ranked "most likely to return" list. Last gameweek's real scores go in
too, since a manager asking about transfers is usually reacting to what just happened.

The data was always there — `FixtureProjection` carries `goalProb`, `assistProb`, `returnProb`
and `cleanSheetProb` — but `PlayerRow.FixtureChip` keeps only difficulty and points, so the
brief reads the projection directly rather than the row.

One trap worth recording: the squad on file belongs to `team.event`, while the projections
describe the week *after* it. Filtering fixtures on `team.event` silently produced an empty
section. The brief now states both explicitly, so the model cannot advise on a locked week.

### /my-team is one grid, placed explicitly

The page used to stack: header, then a full-width row of five stat cards, then a two-column
split of pitch against verdict. On a laptop that put the pitch past halfway down the screen,
and the manager had to scroll to see their own team.

All three blocks now live in a single grid. Source order is the mobile order — stats, pitch,
verdict — and on `lg` each block is placed by hand: the pitch takes column one across both
rows, the stat cards column two row one, the verdict and ratings column two row two. The pitch
therefore starts level with the stat cards rather than below them.

Placing by explicit `col-start`/`row-start` rather than reordering the source is what keeps the
small-screen stack sensible. Any change here should be checked at both widths, because the two
layouts share no ordering logic.

The `Ask about your squad` conversation moved to a drawer in the same pass. A chat panel that
lives in the document pushes everything below it down the moment it opens, which on this page
meant pushing the squad off screen — the thing the manager is asking about.

### Availability flags grade by chance of playing, not status code

The old `StatusDot` was a 7px dot coloured from `status` alone: amber for `d`, red for
everything else. That collapses FPL's own grading — a 75% knock and a 25% muscle injury are
both `d` — and a dot beside a name does not read as a flag at a glance.

`PlayerFlag` colours from `chance_of_playing_next_round`: 75% yellow, 50% amber, 25% orange,
0% or unknown-but-unavailable red. Live data has 100 players at 0%, 16 at 75%, 2 at 50% and 1
at 25%, so all four bands are real rather than theoretical.

It replaced every ad-hoc indicator at once — the dot in the player table, the `!` badges on
both pitches, and the amber-for-everything percentage on the home page — because the same
player was previously flagged three different ways depending on where you saw them.

Note that the players table paginates at 40 rows, so a lightly-owned doubt will not appear on
first load. That is the pagination working, not a missing flag.
