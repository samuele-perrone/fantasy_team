/** Display names and behaviour for the FPL chips. */
export const CHIPS: Record<string, { label: string; short: string; note: string }> = {
  bboost: {
    label: "Bench Boost",
    short: "BB",
    note: "All 15 players score this gameweek, so the bench counts toward your total.",
  },
  "3xc": {
    label: "Triple Captain",
    short: "TC",
    note: "Your captain scores triple rather than double.",
  },
  freehit: {
    label: "Free Hit",
    short: "FH",
    note: "Unlimited transfers for this gameweek only; the squad reverts afterwards.",
  },
  wildcard: {
    label: "Wildcard",
    short: "WC",
    note: "Unlimited transfers with no points hit, and the squad persists.",
  },
  manager: {
    label: "Assistant Manager",
    short: "AM",
    note: "A manager occupies an extra slot and scores from their team's result.",
  },
};

export function chipLabel(chip: string | null | undefined): string | null {
  if (!chip) return null;
  return CHIPS[chip]?.label ?? chip;
}

export function chipNote(chip: string | null | undefined): string | null {
  if (!chip) return null;
  return CHIPS[chip]?.note ?? null;
}

/**
 * True when the chip means every pick scores rather than just the eleven.
 *
 * FPL already encodes this in each pick's multiplier — bench players get 1 instead of 0 —
 * so scoring should always multiply rather than filter by position. This is only needed for
 * wording and for deciding whether "points on bench" is a loss or part of the total.
 */
export function benchCounts(chip: string | null | undefined): boolean {
  return chip === "bboost";
}

export interface ChipStatus {
  key: string;
  label: string;
  note: string;
  /** the half this entry refers to: 1 = GW1-19, 2 = GW20-38 */
  half: 1 | 2;
  firstEvent: number;
  lastEvent: number;
  /** the gameweek it was played in, if it has been */
  usedIn: number | null;
  /** still playable: not used, and the window has not closed */
  available: boolean;
  /** the window has closed unused, so it is gone */
  expired: boolean;
}

const HALVES: { half: 1 | 2; first: number; last: number }[] = [
  { half: 1, first: 1, last: 19 },
  { half: 2, first: 20, last: 38 },
];

/** Chips that cannot be played in gameweek one, because they act on transfers. */
const TRANSFER_CHIPS = new Set(["wildcard", "freehit"]);

/**
 * What is spent, what is left and when it expires.
 *
 * FPL issues a full set of chips per half-season. An unused first-half chip does not roll
 * over — it is simply lost at gameweek 19 — which is the single most expensive thing a
 * manager can forget, so expiry is tracked explicitly rather than inferred.
 */
export function chipStatuses(
  used: { name: string; event: number }[],
  currentEvent: number,
): ChipStatus[] {
  const out: ChipStatus[] = [];

  for (const { half, first, last } of HALVES) {
    for (const key of ["wildcard", "freehit", "bboost", "3xc"]) {
      const meta = CHIPS[key];
      if (!meta) continue;

      const play = used.find((u) => u.name === key && u.event >= first && u.event <= last);
      // Transfer chips are unavailable in gameweek one, when transfers are already unlimited.
      const firstEvent = first === 1 && TRANSFER_CHIPS.has(key) ? 2 : first;

      out.push({
        key,
        label: meta.label,
        note: meta.note,
        half,
        firstEvent,
        lastEvent: last,
        usedIn: play?.event ?? null,
        available: !play && currentEvent <= last,
        expired: !play && currentEvent > last,
      });
    }
  }
  return out;
}
