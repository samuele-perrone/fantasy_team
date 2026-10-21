export interface Tab {
  href: string;
  label: string;
}

/**
 * The whole app. Before adding a tab, check whether it is a section of one of these — the
 * previous site grew to eighteen pages because every idea got its own.
 */
export const TABS: Tab[] = [
  { href: "/matches", label: "Matches" },
  { href: "/squad", label: "My Squad" },
  { href: "/watchlist", label: "Watchlist" },
];
