export interface NavItem {
  href: string;
  label: string;
  desc: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "My Team",
    items: [
      { href: "/my-team", label: "Pick & Rating", desc: "Load your squad and rate every pick" },
      { href: "/squad", label: "Build a Squad", desc: "Enter your 15 by hand or import a screenshot" },
      { href: "/transfers", label: "AI Transfers", desc: "Ranked transfer suggestions for your team" },
      { href: "/team-builder", label: "AI Teams", desc: "Optimal 15 under any budget" },
      { href: "/live", label: "Live Rank", desc: "Live points, bonus and projected rank" },
      { href: "/live#history", label: "Season History", desc: "Every gameweek: points, rank, transfers, value" },
      { href: "/leagues", label: "Mini-Leagues", desc: "Standings, live tables and awards" },
    ],
  },
  {
    label: "Toolbox",
    items: [
      { href: "/players", label: "OPTA Stats", desc: "Every underlying stat, filtered and sorted" },
      { href: "/predictions", label: "Points Predictions", desc: "Modelled xPts for the next 8 GWs" },
      { href: "/fixtures", label: "Fixture Analyser", desc: "Difficulty ticker for all 20 clubs" },
      { href: "/compare", label: "Player Comparison", desc: "Head-to-head on any metric" },
      { href: "/prices", label: "Price Changes", desc: "Tonight's predicted risers and fallers" },
      { href: "/players", label: "Player Profiles", desc: "Full history and projections" },
      { href: "/match-centre", label: "Match Centre", desc: "Fixtures, results and live bonus" },
    ],
  },
  {
    label: "Planners",
    items: [
      { href: "/planner", label: "Transfer Planner", desc: "Plan transfers and chips across the season" },
      { href: "/fixtures?view=calendar", label: "Fixture Calendar", desc: "Full 38-week calendar grid" },
      { href: "/set-pieces", label: "Set Piece Takers", desc: "Penalties, corners and free-kicks" },
      { href: "/scout", label: "Team News", desc: "Injuries, doubts and predicted lineups" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/guides", label: "FPL Guides", desc: "Chip strategy, beginners and blank/double GWs" },
      { href: "/scout", label: "Scout Picks", desc: "This week's differentials and captain shortlist" },
    ],
  },
];

export const QUICK_LINKS: NavItem[] = [
  { href: "/predictions", label: "Predictions", desc: "" },
  { href: "/fixtures", label: "Fixtures", desc: "" },
  { href: "/my-team", label: "My Team", desc: "" },
];
