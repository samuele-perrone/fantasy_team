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

/**
 * A name folded for searching: lower case, accents stripped, so "odegaard" finds Ødegaard and
 * "guehi" finds Guéhi. Ø is not a combining accent in Unicode, so it is mapped by hand.
 */
export const foldName = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ø/g, "o");

export function badgeUrl(teamCode: number) {
  return `https://resources.premierleague.com/premierleague/badges/50/t${teamCode}.png`;
}

export function photoUrl(playerCode: number) {
  return `https://resources.premierleague.com/premierleague/photos/players/110x140/p${playerCode}.png`;
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

/** "2 hours ago", for showing how fresh team news is. */
export function timeAgo(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins)) return null;
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
