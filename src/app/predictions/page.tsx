import type { Metadata } from "next";
import { getGameData, getPlayerRows } from "@/lib/fpl/data";
import { PageHeader } from "@/components/ui";
import { PredictionsClient } from "./predictions-client";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Player Points Predictions",
  description:
    "Modelled expected points for every FPL player over the next 1, 3, 5 or 8 gameweeks — built from minutes models, xG/xA, opponent strength and clean sheet probability.",
};

export default async function PredictionsPage() {
  const [data, rows] = await Promise.all([getGameData(), getPlayerRows(8)]);
  const teams = data.bootstrap.teams.map((t) => ({ id: t.id, short: t.short_name, name: t.name }));
  const nextEvent = data.ctx.nextEvent;

  return (
    <div>
      <PageHeader
        eyebrow="Toolbox"
        title="Player Points Predictions"
        description="Expected points for every player, fixture by fixture. Each projection combines a minutes model, per-90 xG and xA adjusted for opponent strength and venue, Poisson clean sheet probability, defensive contribution thresholds and a bonus-points curve fitted to BPS."
      />
      <PredictionsClient rows={rows} teams={teams} nextEvent={nextEvent} />

      <div className="panel mt-6 px-5 py-4">
        <h2 className="mb-2 text-[13.5px] font-bold text-white">How the model works</h2>
        <div className="grid gap-4 text-[12.5px] leading-relaxed text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-1 font-semibold text-slate-200">1. Minutes</div>
            Start rate is shrunk toward a price-based prior, then scaled by injury and suspension
            flags. Minutes drive appearance, clean sheet and returns points alike.
          </div>
          <div>
            <div className="mb-1 font-semibold text-slate-200">2. Team strength</div>
            Attack and defence ratings are recovered by inverting the fixture difficulty ratings
            each club hands its opponents, blended with FPL&apos;s published strengths.
          </div>
          <div>
            <div className="mb-1 font-semibold text-slate-200">3. Returns</div>
            Per-90 xG and xA are multiplied by a fixture factor from the Poisson expected-goals
            model, with a premium for first-choice penalty takers.
          </div>
          <div>
            <div className="mb-1 font-semibold text-slate-200">4. The rest</div>
            Clean sheets from P(0 conceded), defensive contribution from P(actions ≥ threshold),
            saves, cards and an expected-bonus curve fitted against last season&apos;s BPS data.
          </div>
        </div>
      </div>
    </div>
  );
}
