# The projection model

Every ranking, transfer suggestion and optimised squad rests on one number per player per
fixture: **expected points**. This is how it is built, and where it should not be trusted.

## Inputs

Everything comes from the public FPL API, plus `priors.json` — a committed snapshot of last
season's per-90 rates for 331 players.

## Per fixture

For each upcoming fixture a player's club plays:

### 1. Minutes

The single biggest driver. Start probability is a shrinkage estimate:

```
seed      = 0.75 × (last season's starts / 38)  +  0.25 × price prior
pricePrior = 0.15 + 0.6 × ((cost − £4.0m) / £6.0m)
startProb  = observed × w + seed × (1 − w),   w = games / (games + 6 + 22 × newness)
```

`newness` fades from 1 to 0 over 150 days at a new club, so a summer signing's starts at their
previous club earn trust slowly.

`priorStartRate` blends `starts / 38` with starts per match the player was *involved* in.
Season-long rate alone counts injury-missed matches as "did not start", which the
availability model then discounts again — the same unavailability charged twice.

Expected minutes are `startProb × 81 + cameo × 19`, which peaks near 76 — worth remembering,
because it means "plays 80 minutes" is not expressible as a minutes threshold. The
probability of reaching 60 minutes is `startProb × 0.93`, measured against gameweek one where
126 of 132 starters (95.5%) got there.

### 2. Availability

Resolved per fixture from the news text — see [DECISIONS.md](DECISIONS.md). Multiplies the
minutes model for that fixture only.

### 3. Team strength

FPL zeroes its published attack and defence strengths in pre-season, so ratings are recovered
by inverting the fixture difficulty each club hands its opponents, blended with the published
values once they exist.

Expected goals use a Poisson model:

```
λ = 1.42 × f(attack) × f(6 − opponent defence) × venue      home ×1.11, away ×0.90
```

### 4. Returns

Per-90 xG and xA — blended with last season's rates, weighted by minutes played this season —
scaled by the fixture's attacking multiplier and the player's minutes share. First-choice
penalty takers get a ×1.12 premium.

Goals score 10/6/5/4 by position; assists 3.

### 5. Everything else

- **Clean sheets** — `P(0 conceded)` from the Poisson model, × `P(60 minutes)`
- **Defensive contribution** — `P(actions ≥ threshold)`, 10 for defenders, 12 for others
- **Bonus** — from a BPS-per-90 curve, `clamp((bps90 − 14) × 0.085, 0, 2.2)`
- **Saves, penalties saved, goals conceded, cards** — standard FPL scoring

## Derived numbers

- **xPtsNext** — next gameweek
- **xPts** — summed over the requested horizon, default 5
- **Value** — xPts per £m
- **Rating** — `clamp(perGame × 1.05 + value × 0.32 + startProb × 1.6, 0, 10)`, a composite of
  output, value and minutes security

Squad rating is the mean rating across all 15. Because it includes the bench, the practical
ceiling is about **6.5** — that is what a fully optimised £100m squad scores, not 10.

## Limits worth knowing

**The coefficients are hand-tuned, not fitted.** The rating weights, the 0.085 bonus slope,
the 0.55 strength slope, the 1.42 league average — all calibrated by eye against last season
and sanity-checked. The *rankings* are meaningful; the absolute numbers carry more precision
than they have earned.

**A season cannot be replayed.** FPL exposes no per-gameweek data for past seasons —
`element-summary` carries season totals in `history_past` and per-gameweek rows only for the
season in progress. Accuracy is therefore accumulated forward instead; see
[Measuring accuracy](#measuring-accuracy).

**Early season leans on priors.** Until roughly six matches have been played, most of a
player's projection is last season's rate. Promoted-club players and newcomers with no prior
fall back to the price prior alone.

**Form is not modelled separately.** xG and xA are season-long rates shrunk toward last
season, so a player in a hot streak is not distinguished from their baseline.

**Rotation is invisible.** The model knows minutes history and news, not a manager's intent.
Nothing in the API says "he will be rested for the cup".

**Price change predictions** on `/prices` use a community heuristic — net transfers over an
ownership-scaled threshold. FPL has never published the real formula.

## Retrospective estimates

The gameweek chart on `/my-team` shows the model's estimate beside the actual score for played
weeks, labelled `estimate / actual` above the pair of bars. That estimate is **retrospective**: it runs today's model against that week's fixtures,
and today's model has seen results the original forecast had not. It is a rough calibration
check, not a track record. A real one needs projections snapshotted at each deadline.


## Squad rules

Quotas, the per-club limit, squad and XI sizes, and the budget are read from FPL's
`game_settings` and `element_types` rather than hardcoded, and are threaded through the
optimiser. Legal formations are generated from the published positional minimums. See
[DECISIONS.md](DECISIONS.md).

## Measuring accuracy

`scripts/backtest.mjs` snapshots projections before a deadline and scores them once the
gameweek finishes. A GitHub Action runs it twice daily and commits the results to
`backtest/`, so a track record builds over the season.

```bash
npx tsx scripts/backtest.mjs snapshot   # store projections for the upcoming gameweek
npx tsx scripts/backtest.mjs score      # score every snapshot whose gameweek has finished
npx tsx scripts/backtest.mjs gw1        # one-off out-of-sample check on gameweek one
```

The `gw1` mode needs no snapshot: before the season every current-season stat is zero, so
zeroing them reconstructs exactly what the model knew before the first deadline — last
season's priors, price and fixtures. Nothing from the result leaks back in.

### Why MAE is the wrong headline metric here

The median FPL score in a gameweek is **0** and the mean is 1.65 — the distribution is
heavily right-skewed. MAE is minimised near the median, so a model that systematically
under-predicts scores *better* on MAE while being wrong about every total. Calibration ratios
and RMSE are the honest measures; MAE is reported for continuity, not as the target.

### First result, gameweek one

Only Arsenal v Coventry had been played, so this is 62 players from a single 3-0 match. It is
a smoke test of the harness, not a verdict on the model.

Measured across 364 players from the 12 clubs that had played, after the minutes calibration
fix below.

| Group | n | MAE | Bias | RMSE | r |
| --- | --- | --- | --- | --- | --- |
| All players | 364 | 1.57 | −0.31 | 2.68 | 0.32 |
| Goalkeepers | 40 | 1.43 | −0.05 | 2.36 | 0.43 |
| Defenders | 119 | 1.77 | −0.67 | 3.11 | 0.31 |
| Midfielders | 163 | 1.53 | −0.23 | 2.53 | 0.37 |
| Forwards | 42 | 1.31 | +0.17 | 2.19 | 0.21 |

An earlier read on a single match showed r=0.48; with twelve clubs it settled at 0.32. The
first number was one flattering fixture, which is exactly why a single gameweek proves
nothing.

Defenders remain the weakest position, under-predicted by 0.67 a game — clean sheets and
defensive contributions are the hardest components to call.

**Ignore the "players who actually played" subset.** Filtering to it conditions on an outcome
the model was uncertain about, keeping only the cases where hedging across possible starters
was too low. It looks catastrophic (r=0.09) and means very little.

For context, published FPL models typically reach r=0.3–0.4 over a single gameweek. Weekly
scores are dominated by variance: Mendy returned 15 points against a 0.41 projection.

### The minutes calibration fix

Gameweek one exposed two separate faults, both measurable rather than inferred:

| | Before | After | Actual |
| --- | --- | --- | --- |
| Expected minutes | 0.83× | **0.95×** | 1.00 |
| Players appearing | 0.86× | **1.01×** | 1.00 |
| Players reaching 60' | 0.75× | **0.95×** | 1.00 |
| Total points predicted | 68% | **79%** | 100% |

The `p60` constant assumed 86% of starters reach 60 minutes; the real figure was 95.5%. Since
appearance points are 52% of all FPL scoring and clean sheets a further 22%, that single
constant suppressed roughly three quarters of the model's output.

The second fault was structural: unavailability counted twice, once in `starts / 38` and
again in the availability multiplier.

MAE rose slightly, from 1.51 to 1.57, while bias improved from −0.31 and RMSE from 2.72 to
2.68. That trade is deliberate — see the note above on why MAE rewards under-prediction here.

### What this unlocks

Once enough gameweeks have accumulated, the coefficients — the rating weights, the bonus
slope, the strength slope — can be fitted against measured error rather than chosen by eye.
Until then they remain hand-tuned, and the caveat above stands.
