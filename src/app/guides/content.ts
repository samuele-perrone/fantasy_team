export interface GuideSection {
  heading: string;
  body: string[];
  table?: { head: string[]; rows: string[][] };
}

export interface Guide {
  slug: string;
  title: string;
  category: string;
  summary: string;
  sections: GuideSection[];
}

export const GUIDES: Guide[] = [
  {
    slug: "how-scoring-works",
    title: "How FPL scoring works",
    category: "Beginners",
    summary:
      "Every way a player can earn or lose points, including the defensive contribution rule that changed how midfielders and defenders are valued.",
    sections: [
      {
        heading: "Points for playing",
        body: [
          "A player who appears at all earns 1 point. Play 60 minutes or more — excluding stoppage time — and that becomes 2 points. This is why minutes modelling matters more than anything else: a nailed £4.5m defender who plays 90 minutes every week banks a guaranteed floor that a rotation risk never will.",
        ],
      },
      {
        heading: "Attacking returns",
        body: [
          "Goals are worth more the further back you play, because they are rarer. Assists are flat at 3 points regardless of position.",
        ],
        table: {
          head: ["Position", "Goal", "Assist", "Clean sheet"],
          rows: [
            ["Goalkeeper", "10", "3", "4"],
            ["Defender", "6", "3", "4"],
            ["Midfielder", "5", "3", "1"],
            ["Forward", "4", "3", "0"],
          ],
        },
      },
      {
        heading: "Clean sheets and goals conceded",
        body: [
          "Clean sheets only count if the player has played at least 60 minutes. Goalkeepers and defenders lose 1 point for every 2 goals their team concedes while they are on the pitch, so a defender in a leaky side can post negative scores even with an assist.",
          "Goalkeepers also earn 1 point per 3 saves and 5 points for a saved penalty.",
        ],
      },
      {
        heading: "Defensive contribution",
        body: [
          "Defenders earn 2 points for reaching 10 clearances, blocks, interceptions and tackles in a match. Midfielders and forwards earn the same 2 points at a threshold of 12, but their count also includes ball recoveries.",
          "This single rule reshaped the game. Ball-winning midfielders who used to be unownable now have a floor comparable to an attacking full-back, and the projection model on this site treats it as a Poisson probability of clearing the threshold rather than a flat average.",
        ],
      },
      {
        heading: "Bonus points",
        body: [
          "The three best performers in each match by the Bonus Points System take 3, 2 and 1 extra points. BPS rewards goals, assists, clean sheets, saves, tackles and passes completed, and penalises cards, errors and missed big chances.",
          "Bonus is provisional while a match is live and only confirmed once every game in the gameweek has finished. The Match Centre on this site shows the provisional standings as they move.",
        ],
      },
      {
        heading: "Deductions",
        body: [
          "Yellow card −1, red card −3, own goal −2, missed penalty −2. Each transfer beyond your free allowance costs 4 points, which is the number every transfer plan on this site is measured against.",
        ],
      },
    ],
  },
  {
    slug: "chip-strategy",
    title: "Chip strategy",
    category: "Strategy",
    summary:
      "When to play each chip, how the two-half system changes the calculus, and how to spot the windows in your own fixture run.",
    sections: [
      {
        heading: "What you get",
        body: [
          "You receive a full set of chips in the first half of the season and a second set in the second half. Unused first-half chips expire — they do not roll over — so a chip you are 'saving' past the halfway point is a chip you have thrown away.",
          "Each chip can only be played once per half, and only one chip can be active in any single gameweek.",
        ],
      },
      {
        heading: "Wildcard",
        body: [
          "A free, unlimited rebuild of your squad that persists. The best wildcards are not emergency repairs — they are planned around a fixture swing, where six or seven clubs simultaneously move from a hard run to an easy one.",
          "Use the Fixture Analyser to find the swing, then the AI Teams optimiser to build the squad that exploits it under your exact budget.",
        ],
      },
      {
        heading: "Bench Boost",
        body: [
          "Your four substitutes score for one gameweek. It is worth playing only when all fifteen players have a fixture and your bench is genuinely strong, which usually means a double gameweek where you have deliberately loaded up on players from the doubling clubs.",
          "A typical Bench Boost returns 12–20 points. Playing it on a weak bench in a normal gameweek returns closer to 5, which is barely better than a single transfer.",
        ],
      },
      {
        heading: "Triple Captain",
        body: [
          "Your captain scores triple instead of double. The maths favours the highest-ceiling premium attacker in a double gameweek at home to weak opposition — you are buying variance, so pick the player with the fattest tail, not the safest floor.",
        ],
      },
      {
        heading: "Free Hit",
        body: [
          "A one-week unlimited transfer that reverts afterwards. Its natural home is a blank gameweek, where half your squad has no fixture, or an extreme double gameweek you cannot otherwise field a full team for.",
          "The Transfer & Chip Planner on this site flags your weakest projected week across the next eight, which is usually the right Free Hit candidate.",
        ],
      },
    ],
  },
  {
    slug: "blank-and-double-gameweeks",
    title: "Blank and double gameweeks",
    category: "Strategy",
    summary:
      "Why fixtures get postponed and rescheduled, how to see them coming, and how to build a squad that survives the chaos.",
    sections: [
      {
        heading: "Where they come from",
        body: [
          "When a club reaches a domestic cup final or progresses in Europe, their league fixture is postponed. That creates a blank gameweek — fewer than ten matches — for the clubs involved. The postponed fixture is later slotted into an existing gameweek, creating a double gameweek where some clubs play twice.",
          "Blanks typically cluster around the FA Cup quarter-final and semi-final weekends; doubles usually land in the closing months once the rescheduled dates are confirmed.",
        ],
      },
      {
        heading: "Reading the fixture list early",
        body: [
          "The official fixture list updates as soon as a rearrangement is confirmed, and the Fixture Analyser on this site reads directly from it. A club showing two fixtures in one gameweek column is a confirmed double; an empty column is a confirmed blank.",
          "Do not plan more than two or three gameweeks ahead of a confirmation. Rearrangements move.",
        ],
      },
      {
        heading: "Planning around them",
        body: [
          "The standard sequence is: Free Hit the worst blank, then Bench Boost the best double, and use your second-half Wildcard in the gameweek before to load up on players from the doubling clubs.",
          "The trap is chasing doubles at the expense of everything else. A double gameweek player who plays 60 minutes across two poor fixtures often scores less than a single-fixture premium against a bottom-half defence.",
        ],
      },
    ],
  },
  {
    slug: "price-changes",
    title: "Price changes explained",
    category: "Strategy",
    summary:
      "How prices actually move, what team value is really worth, and why chasing it costs most managers more than it earns.",
    sections: [
      {
        heading: "The mechanism",
        body: [
          "Prices update once a day at around 01:30 UK time. A player rises when enough managers transfer them in and falls when enough transfer them out, with the threshold scaling to how many managers already own them. A 40% owned player needs vastly more net transfers to move than a 2% owned one.",
          "The exact formula has never been published. The Price Changes page on this site models it as net transfers over an ownership-scaled threshold, which tracks the real changes closely but is not exact.",
        ],
      },
      {
        heading: "Selling price",
        body: [
          "You keep half of any profit, rounded down to the nearest £0.1m. Buy a player at £7.0m and sell at £7.3m and you receive £7.1m, not £7.3m. A player can never fall below the price you paid.",
        ],
      },
      {
        heading: "Is team value worth chasing?",
        body: [
          "Marginally. £1.0m of extra team value is worth perhaps two to four points a season in upgraded picks. A single unnecessary −4 hit taken to beat a price rise wipes out most of that.",
          "Take the transfer you want to make for footballing reasons and let the price follow. The only time timing genuinely matters is the last few gameweeks before a wildcard, when locked-in value converts directly into a stronger rebuild.",
        ],
      },
    ],
  },
  {
    slug: "beginners-guide",
    title: "A beginner's guide to FPL",
    category: "Beginners",
    summary:
      "Squad rules, budget structure, and the handful of habits that separate a top-100k finish from a mid-table one.",
    sections: [
      {
        heading: "The squad rules",
        body: [
          "You pick 15 players — 2 goalkeepers, 5 defenders, 5 midfielders and 3 forwards — for £100.0m, with a maximum of 3 players from any one club. Each gameweek you name a starting XI with at least 3 defenders, 2 midfielders and 1 forward, plus a captain who scores double.",
          "You get one free transfer per gameweek. Unused free transfers roll over, up to a maximum of five. Every extra transfer costs 4 points.",
        ],
      },
      {
        heading: "Structuring your budget",
        body: [
          "Roughly £18–20m of your £100m goes on your bench and backup keeper, which means about £80m buys the eleven players who actually score. Deciding how to split that is the core strategic question of the game.",
          "Most successful squads run two or three premium attackers above £9.0m, a spine of £5.5–7.5m mid-price players with good fixtures, and cheap enablers who genuinely start. Cheap players who do not start are the most common way to waste money.",
        ],
      },
      {
        heading: "Habits that actually matter",
        body: [
          "Check team news before the deadline, every single week. A flagged starter is the single largest avoidable loss in the game.",
          "Captain the highest-projected player, not the most exciting one. Captaincy is roughly a sixth of your season total.",
          "Take fewer hits. A −4 needs the incoming player to outscore the outgoing one by more than four points, which is a higher bar than it feels.",
          "Plan two gameweeks ahead, not eight. Fixture runs matter, but injuries and form make anything beyond a month speculative.",
        ],
      },
    ],
  },
  {
    slug: "understanding-underlying-stats",
    title: "Understanding underlying stats",
    category: "Data",
    summary:
      "What xG, xA, ICT and BPS actually measure, and how to use them without being fooled by small samples.",
    sections: [
      {
        heading: "Expected goals and assists",
        body: [
          "xG assigns every shot a probability of being scored based on its location, body part and the situation it came from. xA does the same for the pass before a shot. Summed across a season, they describe the quality of chances a player generated rather than how lucky they were finishing them.",
          "The practical use is separating signal from noise. A forward on 4 goals from 7.5 xG is creating elite chances and finishing badly — that usually corrects. A forward on 7 goals from 2.5 xG is finishing at a rate nobody sustains.",
        ],
      },
      {
        heading: "Per 90 versus totals",
        body: [
          "Always check both. Season totals reward players who simply played more; per-90 figures flatter substitutes who come on against tiring defences. The Player Comparison tool shows both side by side for this reason.",
          "Treat anything under about 500 minutes as a small sample regardless of how good the rate looks.",
        ],
      },
      {
        heading: "ICT index",
        body: [
          "Influence, Creativity and Threat are FPL's own composite scores. Threat is the most useful of the three — it tracks shot volume and quality closely and updates faster than goals do. Creativity broadly tracks chance creation. Influence is the noisiest and least predictive.",
        ],
      },
      {
        heading: "BPS",
        body: [
          "The Bonus Points System is a separate scoring model that decides who gets the 3, 2 and 1 bonus in each match. It rewards actions FPL points ignore — completed passes, tackles won, recoveries — which is why a defensive midfielder can take 3 bonus in a game where they returned nothing.",
          "A player's BPS per 90 is the single best predictor of their future bonus, and it is what this site's projection model uses to estimate expected bonus points.",
        ],
      },
    ],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
