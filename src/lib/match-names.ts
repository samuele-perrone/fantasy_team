import type { PlayerRow } from "./fpl/row";

/**
 * OCR output is noisy — accents get dropped, "rn" reads as "m", and FPL's shirt strips use
 * short names. Matching is therefore done on a normalised form with an edit-distance
 * fallback rather than exact equality.
 */
export function normalise(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance with an early exit once the budget is blown. */
export function editDistance(a: string, b: string, max = 4): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

export interface NameMatch {
  player: PlayerRow;
  score: number;
  exact: boolean;
}

/**
 * Score one OCR line against a player. Returns null when the line is not a plausible match.
 * Higher scores are better; 1 is a perfect hit on the short name FPL prints on the shirt.
 */
function scorePlayer(line: string, player: PlayerRow): number | null {
  const web = normalise(player.name);
  const full = normalise(player.fullName);
  const surname = full.split(" ").slice(-1)[0];

  if (!line || line.length < 3) return null;

  // Exact hits are trustworthy at any length — Rice, Beto and Enzo are all four letters.
  if (line === web) return 1;
  if (line === full) return 0.98;
  if (line === surname) return 0.94;

  // Everything below is approximate. Short tokens are rejected outright because FPL's own
  // interface is full of 3–4 letter words ("Fri", "List", "Next") that would otherwise land
  // within one edit of a real surname.
  if (line.length < 5) return null;

  // OCR often clips the name strip, so allow a prefix match on longer names — but only when
  // the fragment covers most of the name, otherwise "Fri" swallows "Frimpong".
  const covers = (name: string) =>
    name.length >= 5 && line.length >= Math.ceil(name.length * 0.7);

  if (covers(web) && (web.startsWith(line) || line.startsWith(web))) return 0.88;
  if (covers(surname) && (surname.startsWith(line) || line.startsWith(surname))) return 0.85;
  if (line.length >= 5 && (full.includes(` ${line}`) || full.startsWith(`${line} `))) return 0.8;

  const budget = line.length <= 6 ? 1 : line.length <= 9 ? 2 : 3;
  const dWeb = editDistance(line, web, budget);
  if (dWeb <= budget) return 0.86 - dWeb * 0.08;
  const dSur = editDistance(line, surname, budget);
  if (dSur <= budget) return 0.8 - dSur * 0.08;

  return null;
}

/**
 * Words that appear in the FPL interface itself. Without this the deadline banner, tab bar
 * and phone status bar all get read as players.
 */
const STOP_WORDS = new Set([
  "mon", "tue", "tues", "wed", "weds", "thu", "thur", "thurs", "fri", "sat", "sun",
  "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
  "list", "pitch", "next", "back", "add", "player", "add player", "transfers", "transfer",
  "gameweek", "deadline", "free", "unlimited", "bank", "budget", "points", "pts", "team",
  "fantasy", "premier", "league", "wildcard", "bench", "boost", "hit", "hits", "chips", "chip",
  "auto", "pick", "reset", "confirm", "cancel", "make", "more", "info", "view", "stats",
  "fixtures", "fixture", "home", "away", "sub", "subs", "captain", "vice", "kit", "shirt",
  "gkp", "def", "mid", "fwd", "goalkeeper", "defender", "midfielder", "forward",
  "halo", "wifi", "carrier", "search", "filter", "sort", "price", "value", "cost", "total",
]);

/** Best player match for a single OCR line. */
export function matchLine(line: string, players: PlayerRow[]): NameMatch | null {
  const cleaned = normalise(line);
  if (cleaned.length < 3) return null;
  if (STOP_WORDS.has(cleaned)) return null;

  let best: NameMatch | null = null;
  for (const player of players) {
    const score = scorePlayer(cleaned, player);
    if (score === null) continue;
    // Break ties toward the more established player — OCR ambiguity favours the regular starter.
    const tuned = score + Math.min(player.minutes, 3000) / 3000 * 0.02;
    if (!best || tuned > best.score) {
      best = { player, score: tuned, exact: score >= 0.94 };
    }
  }
  return best && best.score >= 0.7 ? best : null;
}

/**
 * Pull player names out of raw OCR text.
 *
 * Tesseract reads a row of shirts as a single line of space-separated words, so the text
 * cannot be treated as one name per line. Every line is tokenised and scanned with a sliding
 * window instead, taking two-word names (van Dijk, Kudus Mohammed) only when the pair is a
 * clearly better hit than either word on its own.
 */
export function matchFreeText(
  text: string,
  players: PlayerRow[],
): { line: string; match: NameMatch | null }[] {
  const candidates: string[] = [];

  for (const rawLine of text.split("\n")) {
    const tokens = rawLine
      .split(/[\s|]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    let i = 0;
    while (i < tokens.length) {
      const one = tokens[i];
      const two = i + 1 < tokens.length ? `${one} ${tokens[i + 1]}` : null;
      const m1 = matchLine(one, players);
      const m2 = two ? matchLine(two, players) : null;

      if (two && m2 && m2.score >= 0.8 && (!m1 || m2.score > m1.score + 0.05)) {
        candidates.push(two);
        i += 2;
        continue;
      }
      if (m1) candidates.push(one);
      i += 1;
    }
  }

  return matchLines(candidates, players);
}

/**
 * Match every OCR line to a distinct player, resolving conflicts by confidence so two
 * lines never claim the same person.
 */
export function matchLines(
  lines: string[],
  players: PlayerRow[],
): { line: string; match: NameMatch | null }[] {
  const scored = lines.map((line) => ({ line, match: matchLine(line, players) }));

  const claimed = new Map<number, number>();
  scored.forEach((entry, index) => {
    if (!entry.match) return;
    const existing = claimed.get(entry.match.player.id);
    if (existing === undefined) {
      claimed.set(entry.match.player.id, index);
      return;
    }
    // Keep the stronger claim and drop the weaker one.
    const other = scored[existing];
    if (other.match && entry.match.score > other.match.score) {
      other.match = null;
      claimed.set(entry.match.player.id, index);
    } else {
      entry.match = null;
    }
  });

  return scored;
}
