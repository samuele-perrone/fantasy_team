export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export const DIFFICULTY_STYLES: Record<number, string> = {
  1: "bg-[#00d97e] text-[#04231a]",
  2: "bg-[#6ee7a8] text-[#06301f]",
  3: "bg-[#cbd2e0] text-[#1b2133]",
  4: "bg-[#fb8c66] text-[#3a1305]",
  5: "bg-[#ef4056] text-[#2d0209]",
};

export const POSITION_STYLES: Record<string, string> = {
  GKP: "bg-amber-400/15 text-amber-300 ring-amber-400/30",
  DEF: "bg-sky-400/15 text-sky-300 ring-sky-400/30",
  MID: "bg-brand-400/15 text-brand-300 ring-brand-400/30",
  FWD: "bg-rose-400/15 text-rose-300 ring-rose-400/30",
};

export const money = (v: number) => `£${v.toFixed(1)}m`;

export interface RatingBand {
  label: string;
  /** value text colour */
  text: string;
  /** progress-bar fill colour */
  bar: string;
}

const BANDS: RatingBand[] = [
  { label: "Elite", text: "text-brand-400", bar: "bg-brand-400" },
  { label: "Strong", text: "text-brand-300", bar: "bg-brand-500/70" },
  { label: "Fair", text: "text-amber-400", bar: "bg-amber-500" },
  { label: "Weak", text: "text-rose-400", bar: "bg-rose-500" },
];

/**
 * Squad ratings are an average across all 15, so cheap enablers drag them down and the
 * practical ceiling is far below 10 — the optimiser's own £100m squad scores about 6.5.
 * Thresholds are set against that rather than against the raw 0–10 range.
 */
export function squadRatingBand(value: number): RatingBand {
  if (value >= 6) return BANDS[0];
  if (value >= 5) return BANDS[1];
  if (value >= 4) return BANDS[2];
  return BANDS[3];
}

/** Individual ratings spread much wider — the median regular starter sits around 3.3. */
export function playerRatingBand(value: number): RatingBand {
  if (value >= 7) return BANDS[0];
  if (value >= 5) return BANDS[1];
  if (value >= 3) return BANDS[2];
  return BANDS[3];
}

export function shirtUrl(teamCode: number, isKeeper = false) {
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}${
    isKeeper ? "_1" : ""
  }-66.webp`;
}

export function badgeUrl(teamCode: number) {
  return `https://resources.premierleague.com/premierleague/badges/50/t${teamCode}.png`;
}

export function photoUrl(playerCode: number) {
  return `https://resources.premierleague.com/premierleague/photos/players/110x140/p${playerCode}.png`;
}

export function relativeDeadline(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Deadline passed";
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${mins % 60}m`;
}

export function formatKickoff(iso: string | null): string {
  if (!iso) return "TBC";
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

/** Blue → white → green scale used for heat-mapped metric cells. */
export function heatStyle(value: number, min: number, max: number): React.CSSProperties {
  if (max <= min) return {};
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return {
    backgroundColor: `color-mix(in oklab, #05c988 ${(t * 42).toFixed(1)}%, transparent)`,
  };
}
