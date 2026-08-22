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

Expected minutes are `startProb × 81 + cameo × 19`, which peaks near 76 — worth remembering,
because it means "plays 80 minutes" is not expressible as a minutes threshold.

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

**There is no backtest.** Nothing has replayed a season to measure error. That is the single
highest-value improvement available, and it would also make it possible to fit the
coefficients properly rather than choosing them.

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
weeks. That estimate is **retrospective**: it runs today's model against that week's fixtures,
and today's model has seen results the original forecast had not. It is a rough calibration
check, not a track record. A real one needs projections snapshotted at each deadline.
