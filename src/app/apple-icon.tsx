import { ImageResponse } from "next/og";

// iOS home-screen icon. Apple ignores SVG favicons and will not round the corners itself,
// so this is rendered as a PNG at the size iOS asks for.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #37e3a0 0%, #04a672 100%)",
          color: "#06070f",
          fontSize: 58,
          fontWeight: 800,
          letterSpacing: -3,
        }}
      >
        FTH
      </div>
    ),
    size,
  );
}
