import type { Metadata } from "next";
import Link from "next/link";
import { getGameData, getPlayerRows } from "@/lib/fpl/data";
import { parseSquadParam } from "@/lib/fpl/entry";
import { SquadBuilder } from "@/components/squad-builder";
import { SavedSquads } from "@/components/saved-squads";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { listSquads } from "@/lib/supabase/squads";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Build a squad manually",
  description:
    "Enter your Fantasy Premier League squad by hand or import it from a screenshot, then run it through every analysis tool — no team ID and no login required.",
};

export default async function SquadPage({ searchParams }: PageProps<"/squad">) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const [data, rows] = await Promise.all([getGameData(), getPlayerRows(5)]);
  const teamCodes: Record<number, number> = {};
  for (const t of data.bootstrap.teams) teamCodes[t.id] = t.code;

  const initialIds = parseSquadParam(one(params.squad));

  // Auth is optional: signed-out visitors get the full builder, just without saving.
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email ?? null;
  const saved = email ? await listSquads() : [];

  return (
    <div>
      <PageHeader
        eyebrow="My Team"
        title="Build your squad"
        description="Add your 15 players by hand or import them from a screenshot, then send the squad through the ratings, transfer and planner tools. Your squad lives in the page URL, so you can bookmark or share it without an account — or sign in to save it and pick it up on any device."
      >
        <Link
          href="/my-team"
          className="rounded-lg border border-pitch-600 px-4 py-2 text-[13px] font-bold text-slate-300 transition hover:border-brand-500 hover:text-white"
        >
          Use a team ID instead
        </Link>
      </PageHeader>

      <SavedSquads
        email={email}
        squads={saved}
        current={
          initialIds.length === 15
            ? {
                name: one(params.name) ?? "My squad",
                playerIds: initialIds,
                captainId: Number(one(params.c)) || null,
                viceCaptainId: Number(one(params.v)) || null,
                formation: null,
                bank: Number(one(params.bank)) || 0,
              }
            : null
        }
      />

      <div className="mt-5" />

      <SquadBuilder
        players={rows}
        teamCodes={teamCodes}
        initialIds={initialIds}
        initialCaptain={Number(one(params.c)) || null}
        initialVice={Number(one(params.v)) || null}
        initialBank={Number(one(params.bank)) || 0}
        initialName={one(params.name) ?? ""}
      />
    </div>
  );
}
