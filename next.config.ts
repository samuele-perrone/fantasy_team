import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Player photos are ~110 KB PNGs at 110×140. Served through the optimiser they arrive as
    // small WebP at the size the avatar is drawn, which matters with fifteen on one screen.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "resources.premierleague.com",
        pathname: "/premierleague/photos/players/**",
      },
    ],
    // Photos change once a season; keep optimised copies for a month.
    minimumCacheTTL: 2_592_000,
  },
};

export default nextConfig;
