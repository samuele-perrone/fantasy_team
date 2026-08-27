import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getGameData } from "@/lib/fpl/data";
import { createClient } from "@/lib/supabase/server";
import { GoogleAnalytics } from "@next/third-parties/google";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/**
 * Nothing is statically prerendered.
 *
 * Every route sits behind the login gate, so static generation bought nothing — but it did
 * make each deploy depend on the FPL API answering during the build. Rendering 28 pages
 * across parallel workers fired concurrent bootstrap requests, FPL rate limited them, and a
 * 403 failed the whole deploy. Live data still comes from the cached client, so the cost of
 * rendering per request is a few milliseconds of projection maths.
 */
export const dynamic = "force-dynamic";

/**
 * Canonical origin, used for absolute URLs in metadata. Set NEXT_PUBLIC_SITE_URL once the
 * domain is live so links and social previews point at fantasyteamhub.com rather than the
 * vercel.app deployment URL.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fantasyteamhub.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "FantasyTeamHub — FPL tools, stats and points predictions",
    template: "%s · FantasyTeamHub",
  },
  description:
    "Points predictions, player stats, fixture analysis, transfer suggestions and squad building for Fantasy Premier League.",
};

async function HeaderWithDeadline() {
  // The header must render even if the FPL API is unreachable, so the deadline is optional.
  let deadline: string | null = null;
  let gwLabel = "";
  let email: string | null = null;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    email = data.user?.email ?? null;
  } catch {
    email = null;
  }

  try {
    const { nextEvent, currentEvent } = await getGameData();
    const event = nextEvent ?? currentEvent;
    deadline = event?.deadline_time ?? null;
    gwLabel = event ? `GW${event.id}` : "";
  } catch {
    deadline = null;
  }
  return <SiteHeader deadline={deadline} gwLabel={gwLabel} email={email} />;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Suspense fallback={<SiteHeader deadline={null} gwLabel="" email={null} />}>
          <HeaderWithDeadline />
        </Suspense>
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-4 sm:py-5">{children}</main>
        <SiteFooter />
        {/* Loaded only when a measurement ID is configured, so local and preview runs stay
            untracked. next/third-parties defers the script so it does not block paint. */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
      </body>
    </html>
  );
}
