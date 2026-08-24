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
        description="Every player in the game, ranked on the underlying numbers. Switch between projection, season, attacking, defensive and market views — every column sorts, and the heat map highlights the leaders in the filtered set."
      />
      <PlayerTable rows={rows} teams={teams} defaultGroup="form" defaultSort="totalPoints" />
    </div>
  );
}
