import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Pitch } from "@/components/pitch";
import { PageHeader, PlayerLink, PositionBadge, StatCard } from "@/components/ui";
import { getGameData, getPlayerRows } from "@/lib/fpl/data";
import { optimiseSquad } from "@/lib/fpl/optimiser";
import { money } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "AI Teams — Squad optimiser",
  description:
    "Build the mathematically optimal Fantasy Premier League squad for any budget. Lock in players you want to keep, ban the ones you don't, and the optimiser fills the rest.",
};

const HORIZONS = [1, 3, 5, 8];

export default async function TeamBuilderPage({ searchParams }: PageProps<"/team-builder">) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const budget = clamp(Number(one(params.budget)) || 100, 60, 120);
  const horizon = HORIZONS.includes(Number(one(params.horizon))) ? Number(one(params.horizon)) : 5;
  const benchWeight = clamp(Number(one(params.bench)) || 0.12, 0, 1);
  const parseIds = (v: string | undefined) =>
    (v ?? "")
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isFinite(x) && x > 0);

  const locked = parseIds(one(params.lock));
  const banned = parseIds(one(params.ban));

  const [data, rows] = await Promise.all([getGameData(), getPlayerRows(horizon)]);
  const teamCodes: Record<number, number> = {};
  for (const t of data.bootstrap.teams) teamCodes[t.id] = t.code;

  const result = optimiseSquad(rows, {
    budget,
    key: horizon === 1 ? "xPtsNext" : "xPts",
    benchWeight,
    locked,
    banned,
    rules: data.rules,
  });

  const byId = new Map(rows.map((r) => [r.id, r]));
  const lockedRows = locked.map((id) => byId.get(id)).filter(Boolean);

  async function update(formData: FormData) {
    "use server";
    const q = new URLSearchParams();
    q.set("budget", String(formData.get("budget") ?? 100));
    q.set("horizon", String(formData.get("horizon") ?? 5));
    q.set("bench", String(formData.get("bench") ?? 0.12));
    const lock = String(formData.get("lock") ?? "").trim();
    const ban = String(formData.get("ban") ?? "").trim();
    if (lock) q.set("lock", lock);
    if (ban) q.set("ban", ban);
    redirect(`/team-builder?${q.toString()}`);
  }

  const captainPoints = result.xi.captain
    ? Number(result.xi.captain[horizon === 1 ? "xPtsNext" : "xPts"])
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My Team"
        title="AI Teams"
        description="A Lagrangian greedy sweep followed by steepest-ascent local search over every legal swap, maximising the projected points of the best starting XI subject to the £100m budget, the 2/5/5/3 quotas and the three-per-club limit."
      />

      <form action={update} className="panel grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Budget (£m)">
          <input
            name="budget"
            type="number"
            step={0.5}
            min={60}
            max={120}
            defaultValue={budget}
            className="h-9 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 text-[13.5px] outline-none focus:border-brand-500"
          />
        </Field>
        <Field label="Horizon">
          <select
            name="horizon"
            defaultValue={horizon}
            className="h-9 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-2 text-[13.5px] outline-none focus:border-brand-500"
          >
            {HORIZONS.map((h) => (
              <option key={h} value={h}>
                {h === 1 ? "Next gameweek" : `Next ${h} gameweeks`}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bench weight">
          <input
            name="bench"
            type="number"
            step={0.02}
            min={0}
            max={1}
            defaultValue={benchWeight}
            className="h-9 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 text-[13.5px] outline-none focus:border-brand-500"
          />
        </Field>
        <Field label="Lock in (player IDs)">
          <input
            name="lock"
            defaultValue={locked.join(",")}
            placeholder="e.g. 351,182"
            className="h-9 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 text-[13.5px] outline-none placeholder:text-slate-600 focus:border-brand-500"
          />
        </Field>
        <div className="flex items-end gap-2">
          <Field label="Exclude (player IDs)" className="flex-1">
            <input
              name="ban"
              defaultValue={banned.join(",")}
              placeholder="e.g. 427"
              className="h-9 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 text-[13.5px] outline-none placeholder:text-slate-600 focus:border-brand-500"
            />
          </Field>
          <button
            type="submit"
            className="h-9 shrink-0 rounded-lg bg-brand-500 px-4 text-[13px] font-bold text-pitch-950 transition hover:bg-brand-400"
          >
            Optimise
          </button>
        </div>
      </form>

      {!result.squad.length ? (
        <div className="panel px-6 py-10 text-center text-[13.5px] text-amber-300">
          No legal squad fits those constraints. Try raising the budget or removing some locks.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Squad cost" value={money(result.cost)} sub={`${money(budget - result.cost)} left over`} />
            <StatCard label="Formation" value={result.xi.formation} sub="Best legal shape" />
            <StatCard
              label="XI projection"
              value={result.xi.startingPoints.toFixed(1)}
              sub={horizon === 1 ? "Next gameweek" : `Next ${horizon} gameweeks`}
              tone="brand"
            />
            <StatCard
              label="With captain"
              value={(result.xi.startingPoints + captainPoints).toFixed(1)}
              sub={result.xi.captain ? `(C) ${result.xi.captain.name}` : undefined}
              tone="brand"
            />
            <StatCard
              label="Bench projection"
              value={result.xi.benchPoints.toFixed(1)}
              sub={`Weighted at ${benchWeight}`}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <Pitch
              xi={result.xi}
              metric={horizon === 1 ? "xPtsNext" : "xPts"}
              metricLabel={horizon === 1 ? "xPts" : `${horizon} GW`}
              teamCodes={teamCodes}
            />

            <div className="space-y-4">
              <div className="panel px-5 py-4">
                <h2 className="mb-2.5 text-[14px] font-bold text-white">Squad breakdown</h2>
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-pitch-800 text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="py-1.5 text-left">Player</th>
                      <th className="text-right">£</th>
                      <th className="text-right">xPts</th>
                      <th className="text-right">Own%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...result.squad]
                      .sort((a, b) => a.posId - b.posId || b.xPts - a.xPts)
                      .map((p) => (
                        <tr key={p.id} className="border-b border-pitch-800/50">
                          <td className="py-1.5">
                            <span className="flex items-center gap-2">
                              <PositionBadge pos={p.pos} />
                              <PlayerLink id={p.id} name={p.name} />
                              <span className="text-[11px] text-slate-500">{p.team}</span>
                            </span>
                          </td>
                          <td className="num text-right text-slate-300">{p.cost.toFixed(1)}</td>
                          <td className="num text-right font-semibold text-brand-400">
                            {(horizon === 1 ? p.xPtsNext : p.xPts).toFixed(1)}
                          </td>
                          <td className="num text-right text-slate-500">
                            {p.selectedBy.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="panel px-5 py-4 text-[12.5px] leading-relaxed text-slate-400">
                <h3 className="mb-1.5 text-[13px] font-bold text-white">Reading the output</h3>
                Bench weight controls how much the optimiser cares about your substitutes. At 0 it
                spends nothing on the bench and maximises the XI; push it toward 0.4 and you get a
                squad that survives rotation and injuries at the cost of raw ceiling.
                {lockedRows.length > 0 && (
                  <p className="mt-2 text-slate-500">
                    Locked in: {lockedRows.map((p) => p!.name).join(", ")}. Find any player&apos;s ID
                    in the URL of their profile page.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
