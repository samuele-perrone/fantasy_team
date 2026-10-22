import { ImageResponse } from "next/og";

// iOS home-screen icon. Apple ignores SVG favicons and masks the corners itself, so this is a
// full-bleed square PNG at the size iOS asks for. The master artwork is in public/brand/.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The verdict bars, keep, watch and sell, in a 100-unit grid scaled to the icon. */
const BARS = [
  { y: 25, w: 56, color: "#05c988" },
  { y: 44, w: 40, color: "#f5b83d" },
  { y: 63, w: 24, color: "#f0566e" },
];

export default function AppleIcon() {
  const u = size.width / 100;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#101426" }}>
        {BARS.map((b) => (
          <div
            key={b.y}
            style={{
              position: "absolute",
              left: 22 * u,
              top: b.y * u,
              width: b.w * u,
              height: 13 * u,
              borderRadius: 6.5 * u,
              background: b.color,
            }}
          />
        ))}
      </div>
    ),
    size,
  );
}
