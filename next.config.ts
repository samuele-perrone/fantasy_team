import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The app was cut from eighteen pages to six. These redirect the removed routes to
   * whichever survivor absorbed them, so bookmarks and old links keep working rather than
   * hitting a 404.
   */
  async redirects() {
    return [
      { source: "/predictions", destination: "/players", permanent: true },
      { source: "/team-builder", destination: "/squad", permanent: true },
      { source: "/live", destination: "/my-team", permanent: true },
      { source: "/planner", destination: "/my-team", permanent: true },
      { source: "/compare", destination: "/players", permanent: true },
      { source: "/set-pieces", destination: "/players", permanent: true },
      { source: "/match-centre", destination: "/fixtures", permanent: true },
      { source: "/prices", destination: "/players", permanent: true },
      { source: "/leagues", destination: "/my-team", permanent: true },
      { source: "/guides", destination: "/", permanent: true },
      { source: "/guides/:slug", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
