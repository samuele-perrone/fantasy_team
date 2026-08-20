# Fantasy Hub

A Fantasy Premier League analytics site — points projections, OPTA-style stats, fixture
analysis, price change predictions, AI transfer suggestions and a squad optimiser — built on
the official FPL API.

```bash
npm install
npm run dev      # http://localhost:3000
```

No API keys or environment variables are required. The FPL API is public.

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
| `/scout` | Injuries, doubts and bans; model-predicted lineups; captain and differential shortlists |
| `/set-pieces` | Penalty, corner and free-kick takers for every club |
| `/my-team` | Load your squad by FPL ID — ratings for every pick, optimal XI, captaincy verdict |
| `/transfers` | Ranked 1–3 transfer plans scored net of points hits, plus a wildcard draft |
| `/team-builder` | Squad optimiser for any budget, with lock-in and exclusion constraints |
| `/live` | Live gameweek points with provisional bonus and captain multipliers |
| `/planner` | Eight-week projection for your squad with chip windows picked out |
| `/leagues` | Classic mini-league standings, movement and awards |
| `/guides` | Scoring rules, chip strategy, blank/double gameweeks, price changes, underlying stats |

## Architecture

```
src/lib/fpl/
  client.ts      Typed FPL API client. Server-only, revalidating fetch cache per endpoint.
  types.ts       Response types for every endpoint used.
  ratings.ts     Team strength recovery + Poisson expected goals model.
  projection.ts  Per-player, per-fixture expected points model.
  row.ts         Flat PlayerRow DTO shared between server and client components.
  data.ts        Request-deduped game data and player row assembly.
  team-runs.ts   Team-level fixture runs for the fixture analyser.
  optimiser.ts   Best-XI solver, squad optimiser and transfer planner.
  entry.ts       Loads and normalises a manager's squad.
```

Pages are React Server Components that fetch on the server; only the interactive tables,
filters and the header are client components.

### The projection model

Expected points for a player in a given fixture are built from five parts:

1. **Minutes.** Start rate is shrunk toward a price-based prior — a £13m forward with no data
   is far more likely nailed than a £4.0m one — then scaled by injury and suspension flags.
   Minutes drive appearance, clean sheet and returns points alike.
2. **Team strength.** FPL zeroes out its published attack and defence strengths in pre-season,
   so ratings are recovered by inverting the fixture difficulty each club hands its opponents,
   blended back with the published strengths once they are populated.
3. **Returns.** Per-90 xG and xA are scaled by a fixture factor from a Poisson expected-goals
   model with home advantage, plus a premium for first-choice penalty takers.
4. **Clean sheets and defensive contribution.** Clean sheets from `P(0 conceded)`; defensive
   contribution points from `P(actions ≥ threshold)` — 10 for defenders, 12 for everyone else.
5. **Bonus, saves and cards.** Expected bonus comes from a curve fitted against last season's
   BPS-to-bonus relationship.

### The optimiser

Squad selection is a knapsack with quota (2/5/5/3), budget and three-per-club constraints. It
is solved with a Lagrangian-style greedy sweep over price penalties, followed by
steepest-ascent single-player swaps until no improvement remains — typically under 20ms for
the full ~600-player pool.

## Testing against a fixture server

`FPL_API_BASE` overrides the upstream API, which is useful before the first deadline of a
season when no manager picks are published yet:

```bash
FPL_API_BASE=http://localhost:4555 npm run dev
```

## Notes

Data comes from the official Fantasy Premier League API. Projections are modelled in-house.
This project is not affiliated with or endorsed by the Premier League.
