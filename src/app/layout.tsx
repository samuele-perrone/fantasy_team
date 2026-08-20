import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getGameData } from "@/lib/fpl/data";
import { createClient } from "@/lib/supabase/server";

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

export const metadata: Metadata = {
  title: {
    default: "Fantasy Hub — FPL tools, stats and points predictions",
    template: "%s · Fantasy Hub",
  },
  description:
    "Points predictions, OPTA stats, fixture analysis, price change alerts, AI transfer suggestions and squad optimisation for Fantasy Premier League.",
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
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 sm:py-8">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
