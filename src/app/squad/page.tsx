import type { Metadata } from "next";
import Link from "next/link";
import { getGameData, getPlayerRows } from "@/lib/fpl/data";
import { parseSquadParam } from "@/lib/fpl/entry";
import { SquadBuilder } from "@/components/squad-builder";
import { SavedSquads } from "@/components/saved-squads";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getDraft, listSquads } from "@/lib/supabase/squads";
import { describeRules, ruleDrift } from "@/lib/fpl/rules";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Build a squad manually",
  description:
    "Enter your Fantasy Premier League squad by hand or import it from a screenshot, then run it through every analysis tool — no team ID and no login required.",
};

/**
 * Shows which rules are being enforced and how fresh the data is. The rules are read from
 * FPL, so if they ever change mid-season this says so rather than the optimiser silently
 * building squads against last year's constraints.
 */
function DataSync({ data }: { data: Awaited<ReturnType<typeof getGameData>> }) {
  const drift = ruleDrift(data.rules);
  const event = data.nextEvent ?? data.currentEvent;
  const flagged = data.bootstrap.elements.filter((p) => p.status !== "a").length;

  return (
    <div className="panel mb-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2.5 text-[11.5px]">
      <span className="font-bold uppercase tracking-wider text-slate-500">Live from FPL</span>
      <span className="text-slate-400">{describeRules(data.rules)}</span>
      <span className="text-slate-400">
        {flagged} flagged player{flagged === 1 ? "" : "s"}
      </span>
      {event && <span className="text-slate-400">{event.name} next</span>}
      <span className="ml-auto text-slate-600">
        refreshed at least every 5 minutes
      </span>
      {drift.length > 0 && (
        <span className="w-full rounded bg-amber-500/15 px-2 py-1 text-amber-300">
          FPL has changed the rules since this app was built: {drift.join(", ")}. We follow
          the live rules when building and checking squads, so yours stays legal — this is just
          a heads-up that the game has changed, not a fault.
        </span>
      )}
    </div>
  );
}

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

  // With nothing in the URL, reopen whatever was last being built.
  const draft = email && initialIds.length === 0 ? await getDraft() : null;
  const startIds = initialIds.length ? initialIds : (draft?.playerIds ?? []);

  return (
    <div>
      <PageHeader
        eyebrow="My Team"
        title="Build your squad"
        description="Add your 15 players by hand, import them from a screenshot, or let us pick the best squad for your budget. Your squad is stored in the page address, so you can bookmark or share it without an account — or sign in to save it and pick it up on any device."
      >
        <Link
          href="/my-team?enter=1"
          className="rounded-lg border border-pitch-600 px-4 py-2 text-[13px] font-bold text-slate-300 transition hover:border-brand-500 hover:text-white"
        >
          Use a team ID instead
        </Link>
      </PageHeader>

      <DataSync data={data} />

      <SavedSquads
        email={email}
        squads={saved}
        current={
          startIds.length === 15
            ? {
                name: one(params.name) ?? "My squad",
                playerIds: startIds,
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
        initialIds={startIds}
        initialCaptain={Number(one(params.c)) || draft?.captainId || null}
        initialVice={Number(one(params.v)) || draft?.viceCaptainId || null}
        initialBank={Number(one(params.bank)) || draft?.bank || 0}
        initialName={one(params.name) ?? ""}
        canPersist={Boolean(email)}
        rules={data.rules}
      />
    </div>
  );
}
