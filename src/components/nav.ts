export interface Tab {
  href: string;
  label: string;
}

/**
 * The whole app. Before adding a tab, check whether it is a section of one of these — the
 * previous site grew to eighteen pages because every idea got its own. Players became the
 * fourth tab rather than a Watchlist section: see docs/DECISIONS.md.
 */
export const TABS: Tab[] = [
  { href: "/matches", label: "Matches" },
  { href: "/squad", label: "My Squad" },
  { href: "/players", label: "Players" },
  { href: "/watchlist", label: "Watchlist" },
];
