import type { Metadata } from "next";
import { getPlayerRows } from "@/lib/fpl/data";
import { PageHeader } from "@/components/ui";
import { CompareClient } from "./compare-client";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Player Comparison",
  description:
    "Compare up to four Fantasy Premier League players head to head on projections, underlying stats, fixtures and ownership.",
};

export default async function ComparePage({ searchParams }: PageProps<"/compare">) {
  const params = await searchParams;
  const raw = params.ids;
  const ids = (Array.isArray(raw) ? raw.join(",") : (raw ?? ""))
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0);

  const rows = await getPlayerRows(5);

  // Sensible default so the page is never empty on first load.
  const fallback = [...rows]
    .filter((r) => r.status === "a")
    .sort((a, b) => b.xPtsNext - a.xPtsNext)
    .slice(0, 3)
    .map((r) => r.id);

  return (
    <div>
      <PageHeader
        eyebrow="Toolbox"
        title="Player Comparison"
        description="Put up to four players side by side across projections, season output, attacking and defensive underlying numbers, and the transfer market. The best value in each row is highlighted."
      />
      <CompareClient rows={rows} initialIds={ids.length ? ids : fallback} />
    </div>
  );
}
