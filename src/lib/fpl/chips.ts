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
