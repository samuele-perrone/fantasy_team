import type { Metadata } from "next";
import Link from "next/link";
import { getGameData } from "@/lib/fpl/data";
import { PageHeader } from "@/components/ui";
import { GUIDES } from "./content";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "FPL Guides",
  description:
    "Scoring rules, chip strategy, blank and double gameweeks, price changes and a beginner's guide to Fantasy Premier League.",
};

export default async function GuidesIndex() {
  const data = await getGameData();
  const event = data.nextEvent ?? data.currentEvent;

  return (
    <div>
      <PageHeader
        eyebrow="Content"
        title="FPL Guides"
        description="The rules, the maths and the strategy — everything you need to play the game well, written against the current season's scoring system."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {GUIDES.map((g) => (
          <Link
            key={g.slug}
            href={`/guides/${g.slug}`}
            className="panel group px-5 py-4 transition hover:border-brand-500/60"
          >
            <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-brand-400">
              {g.category}
            </div>
            <h2 className="text-[16px] font-bold text-white group-hover:text-brand-400">
              {g.title}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{g.summary}</p>
            <div className="mt-2.5 text-[12px] font-semibold text-brand-400">Read guide →</div>
          </Link>
        ))}
      </div>

      {event && (
        <div className="panel mt-6 px-5 py-4 text-[13px] text-slate-400">
          Next deadline is <strong className="text-white">{event.name}</strong>. Head to the{" "}
          <Link href="/predictions" className="text-brand-400 hover:underline">
            points predictions
          </Link>{" "}
          to put any of this into practice.
        </div>
      )}
    </div>
  );
}
