export interface NavItem {
  href: string;
  label: string;
  desc: string;
}

/**
 * Six links, flat. The app previously had 24 nav entries across four dropdowns, much of it
 * overlapping — two player tables, two squad builders, three places showing your own team.
 * What a manager actually does each week is check the squad, then decide transfers.
 */
export const NAV: NavItem[] = [
  { href: "/my-team", label: "My Team", desc: "Your squad, score and what to change" },
  { href: "/transfers", label: "Transfers", desc: "Who to bring in, and whether it is worth it" },
  { href: "/players", label: "Players", desc: "Every player, ranked" },
  { href: "/squad", label: "Build", desc: "Build or auto-pick a squad" },
  { href: "/fixtures", label: "Fixtures", desc: "Who plays who, and how hard" },
  { href: "/scout", label: "News", desc: "Injuries, doubts and suspensions" },
];
