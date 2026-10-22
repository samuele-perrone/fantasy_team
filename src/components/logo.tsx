/**
 * The FantasyTeamHub mark: three bars in the verdict colours — keep, watch, sell — which also
 * read as an F. Colours come from the --logo-* variables in globals.css, so it follows the
 * theme. The app icon and favicon are drawn separately (src/app/icon.svg, apple-icon.tsx).
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <rect
        x="1"
        y="1"
        width="98"
        height="98"
        rx="21"
        fill="var(--logo-bg)"
        stroke="var(--logo-edge)"
        strokeWidth="2"
      />
      <rect x="22" y="25" width="56" height="13" rx="6.5" fill="var(--logo-keep)" />
      <rect x="22" y="44" width="40" height="13" rx="6.5" fill="var(--logo-watch)" />
      <rect x="22" y="63" width="24" height="13" rx="6.5" fill="var(--logo-sell)" />
    </svg>
  );
}
