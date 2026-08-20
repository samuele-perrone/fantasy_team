import type { FplElement } from "./types";

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * FPL writes return dates as "Expected back 23 Aug" with no year. The year is inferred as
 * whichever reading lands nearest to today, so a December date read in January resolves to
 * the December just gone rather than eleven months away.
 */
export function parseReturnDate(news: string, now = new Date()): Date | null {
  const m = /expected back\s+(\d{1,2})\s+([a-z]{3})/i.exec(news ?? "");
  if (!m) return null;

  const day = Number(m[1]);
  const month = MONTHS[m[2].toLowerCase()];
  if (month === undefined || day < 1 || day > 31) return null;

  const candidates = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(
    (year) => new Date(Date.UTC(year, month, day)),
  );
  return candidates.reduce((best, d) =>
    Math.abs(d.getTime() - now.getTime()) < Math.abs(best.getTime() - now.getTime()) ? d : best,
  );
}

export interface NewsStatus {
  /** parsed from "Expected back …", null when FPL gives no date */
  returnDate: Date | null;
  /** true when the player is ruled out with no stated return */
  indefinite: boolean;
  suspended: boolean;
  /** chance of playing the next round, 0–1, when FPL publishes one */
  chance: number | null;
}

export function readNews(p: FplElement, now = new Date()): NewsStatus {
  const returnDate = parseReturnDate(p.news ?? "", now);
  const out = p.status === "i" || p.status === "u" || p.status === "n";
  return {
    returnDate,
    indefinite: out && !returnDate,
    suspended: p.status === "s",
    chance:
      p.chance_of_playing_next_round === null || p.chance_of_playing_next_round === undefined
        ? null
        : Math.min(Math.max(p.chance_of_playing_next_round / 100, 0), 1),
  };
}

/**
 * How available a player is for one specific fixture, 0–1.
 *
 * Availability is deliberately per-fixture rather than a single season-long multiplier: a
 * knock affects the next match, not the next five, and "expected back 23 Aug" means a player
 * is fully available from the second gameweek onward. Treating both as a flat discount
 * across the horizon badly under-rates players who are about to return.
 */
export function availabilityFor(
  p: FplElement,
  kickoff: string | null,
  eventOffset: number,
  now = new Date(),
): number {
  if (p.status === "a" && p.chance_of_playing_next_round === null) return 1;

  const news = readNews(p, now);

  if (news.returnDate) {
    const when = kickoff ? new Date(kickoff) : null;
    if (!when) return news.indefinite ? 0 : 0.5;
    if (when < news.returnDate) return 0;
    // Freshly back from injury usually means a cautious reintroduction.
    const daysBack = (when.getTime() - news.returnDate.getTime()) / 86_400_000;
    return daysBack < 7 ? 0.65 : 1;
  }

  // Ruled out with no stated return — assume unavailable for the whole horizon.
  if (news.indefinite) return 0;

  // Suspensions in FPL are nearly always a single match.
  if (news.suspended) return eventOffset === 0 ? 0 : 1;

  if (news.chance !== null) {
    // A published chance applies to the next round; recovery is assumed after that, easing
    // back rather than jumping straight to fully fit.
    if (eventOffset === 0) return news.chance;
    return Math.min(1, news.chance + 0.25 * eventOffset);
  }

  return 1;
}

/** Short human label for why a player is flagged, or null when they are fine. */
export function newsLabel(p: FplElement, now = new Date()): string | null {
  if (p.status === "a" && p.chance_of_playing_next_round === null) return null;
  const news = readNews(p, now);
  if (news.returnDate) {
    return `back ${news.returnDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  }
  if (news.indefinite) return "out, no return date";
  if (news.suspended) return "suspended";
  if (news.chance !== null && news.chance < 1) return `${Math.round(news.chance * 100)}% chance`;
  return null;
}

/**
 * Row-friendly version of {@link newsLabel} for client components, which hold the flattened
 * PlayerRow rather than the raw API element.
 */
export function rowNewsLabel(row: {
  status: string;
  news: string;
  availability: number | null;
}): string | null {
  if (row.status === "a" && !row.news) return null;
  const back = parseReturnDate(row.news ?? "");
  if (back) {
    return `back ${back.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  }
  if (row.status === "s") return "suspended";
  if (row.availability !== null && row.availability < 100) return `${row.availability}% chance`;
  if (row.status === "i" || row.status === "u" || row.status === "n") return "out";
  return null;
}
