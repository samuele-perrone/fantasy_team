import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { THEME_SCRIPT } from "@/components/theme-toggle";
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
    default: "FantasyTeamHub",
    template: "%s · FantasyTeamHub",
  },
  description: "Your FPL squad, what to keep, what to sell, and who to buy next.",
  // Private while invite-only.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Follows the system setting; a manual choice in the header does not reach the browser chrome.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5fa" },
    { media: "(prefers-color-scheme: dark)", color: "#06070f" },
  ],
  // Lets the safe-area insets work on phones with a notch and a home indicator.
  viewportFit: "cover",
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
      // THEME_SCRIPT sets data-theme before React hydrates, which React would otherwise flag.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <Suspense fallback={<SiteHeader deadline={null} gwLabel="" email={null} />}>
          <HeaderWithDeadline />
        </Suspense>
        {/* Full width on a computer, one column on a phone; the bottom padding clears the
            phone's fixed tab bar, which wider screens replace with the header's tabs. */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-4 md:px-6 md:pt-8 lg:px-8 lg:pb-16">
          {children}
        </main>
        <TabBar />
        {/* Loaded only when a measurement ID is configured, so local and preview runs stay
            untracked. next/third-parties defers the script so it does not block paint. */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
      </body>
    </html>
  );
}
