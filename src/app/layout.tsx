import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { NAV } from "@/components/nav";
import { getGameData } from "@/lib/fpl/data";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
  try {
    const { nextEvent, currentEvent } = await getGameData();
    const event = nextEvent ?? currentEvent;
    deadline = event?.deadline_time ?? null;
    gwLabel = event ? `GW${event.id}` : "";
  } catch {
    deadline = null;
  }
  return <SiteHeader deadline={deadline} gwLabel={gwLabel} />;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Suspense fallback={<SiteHeader deadline={null} gwLabel="" />}>
          <HeaderWithDeadline />
        </Suspense>
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 sm:py-8">{children}</main>
        <footer className="mt-12 border-t border-pitch-800 bg-pitch-950/60">
          <div className="mx-auto max-w-[1500px] px-4 py-10">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {NAV.map((group) => (
                <div key={group.label}>
                  <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {group.label}
                  </div>
                  <ul className="space-y-1.5">
                    {group.items.map((item) => (
                      <li key={item.label}>
                        <Link
                          href={item.href}
                          className="text-[13px] text-slate-400 transition hover:text-brand-400"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-8 border-t border-pitch-800 pt-6 text-[11.5px] leading-relaxed text-slate-600">
              Data from the official Fantasy Premier League API. Projections are modelled in-house
              and are not affiliated with or endorsed by the Premier League.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
