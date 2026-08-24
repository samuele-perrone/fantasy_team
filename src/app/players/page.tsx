import type { Metadata } from "next";
import { getGameData, getPlayerRows } from "@/lib/fpl/data";
import { PlayerTable } from "@/components/player-table";
import { PageHeader } from "@/components/ui";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Players",
  description:
    "Every Fantasy Premier League player ranked on the numbers that matter — goals, assists, minutes, defensive work, ownership and projected points.",
};

export default async function PlayersPage() {
  const [data, rows] = await Promise.all([getGameData(), getPlayerRows(5)]);
  const teams = data.bootstrap.teams.map((t) => ({ id: t.id, short: t.short_name, name: t.name }));

  return (
    <div>
      <PageHeader
        eyebrow="Toolbox"
        title="Players"
        description="Every player in the game, ranked. Switch between what we expect next, season so far, attacking, defending and who is being bought and sold. Click any column to sort by it, and the colours show who leads whatever you have filtered to."
      />
      <PlayerTable rows={rows} teams={teams} defaultGroup="form" defaultSort="totalPoints" />
    </div>
  );
}
