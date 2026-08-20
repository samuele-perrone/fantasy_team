"use client";

import { useCallback, useRef, useState } from "react";
import type { PlayerRow } from "@/lib/fpl/row";
import { matchFreeText, matchLine } from "@/lib/match-names";
import { cn, money } from "@/lib/utils";
import { PositionBadge } from "./ui";

export interface ImportMatch {
  line: string;
  player: PlayerRow | null;
  confident: boolean;
  /** unticked rows are ignored on import */
  selected: boolean;
}

const QUOTA: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 };
const POS_SHORT: Record<number, string> = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };
const TEAM_LIMIT = 3;

/**
 * Walk the ticked rows in order and mark the first legal 15. Anything that busts a positional
 * quota or the three-per-club limit is reported with the reason rather than silently dropped.
 */
function planImport(matches: ImportMatch[]) {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const clubs = new Map<number, number>();
  const taken = new Set<number>();
  const status = new Map<number, string | null>();

  matches.forEach((m, i) => {
    if (!m.player || !m.selected) return;
    const p = m.player;
    if (taken.has(p.id)) return void status.set(i, "Duplicate");
    if (counts[p.posId] >= QUOTA[p.posId]) {
      return void status.set(i, `Already have ${QUOTA[p.posId]} ${POS_SHORT[p.posId]}`);
    }
    if ((clubs.get(p.teamId) ?? 0) >= TEAM_LIMIT) {
      return void status.set(i, `Max ${TEAM_LIMIT} from ${p.team}`);
    }
    counts[p.posId]++;
    clubs.set(p.teamId, (clubs.get(p.teamId) ?? 0) + 1);
    taken.add(p.id);
    status.set(i, null);
  });

  return { counts, status, total: taken.size };
}

type Phase = "idle" | "reading" | "review" | "error";

/**
 * Reads an FPL team screenshot in the browser with Tesseract. Nothing is uploaded — the
 * image never leaves the page, and the OCR worker is loaded lazily so the ~2MB of wasm only
 * downloads when someone actually imports.
 */
export function ScreenshotImport({
  players,
  onImport,
}: {
  players: PlayerRow[];
  onImport: (matches: ImportMatch[]) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [matches, setMatches] = useState<ImportMatch[]>([]);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = useCallback(
    async (file: File) => {
      setPhase("reading");
      setProgress(0);
      setError("");
      setPreview(URL.createObjectURL(file));

      try {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng", 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
          },
        });

        const bitmap = await createImageBitmap(file);
        // FPL name strips are small; upscaling short edges materially improves recognition.
        const scale = Math.min(3, Math.max(1, 1400 / Math.min(bitmap.width, bitmap.height)));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not read the image.");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

        const { data } = await worker.recognize(canvas);
        await worker.terminate();

        const results = matchFreeText(data.text, players)
          .filter((r) => r.match)
          .map((r) => ({
            line: r.line,
            player: r.match!.player,
            confident: r.match!.exact,
            selected: true,
          }));

        if (!results.length) {
          setError(
            "No player names could be read from that image. Try a larger, sharper screenshot of the pitch view — or just search for your players below.",
          );
          setPhase("error");
          return;
        }

        setMatches(results);
        setPhase("review");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong reading that image.");
        setPhase("error");
      }
    },
    [players],
  );

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file is not an image.");
      setPhase("error");
      return;
    }
    void run(file);
  };

  // Let people paste a screenshot straight from the clipboard.
  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.files)[0];
    if (item) {
      e.preventDefault();
      onFile(item);
    }
  };

  const replace = (index: number, playerId: number) => {
    setMatches((prev) =>
      prev.map((m, i) =>
        i === index
          ? {
              ...m,
              player: players.find((p) => p.id === playerId) ?? null,
              confident: true,
              selected: true,
            }
          : m,
      ),
    );
  };

  const reset = () => {
    setPhase("idle");
    setMatches([]);
    setPreview(null);
    setProgress(0);
    setError("");
  };

  const plan = planImport(matches);

  return (
    <section className="panel px-4 py-3.5" onPaste={onPaste}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[14px] font-bold text-white">Import from a screenshot</h2>
          <p className="text-[12px] text-slate-500">
            Screenshot your team on the FPL site or app, then drop it here. The image is read in
            your browser and never uploaded.
          </p>
        </div>
        {phase !== "idle" && (
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-pitch-600 px-3 py-1.5 text-[12px] font-semibold text-slate-400 transition hover:text-white"
          >
            Start over
          </button>
        )}
      </div>

      {phase === "idle" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFile(e.dataTransfer.files[0]);
          }}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "cursor-pointer rounded-xl border-2 border-dashed px-4 py-7 text-center transition",
            dragging
              ? "border-brand-500 bg-brand-500/5"
              : "border-pitch-600 hover:border-brand-500/60",
          )}
        >
          <div className="text-[13.5px] font-semibold text-slate-300">
            Drop a screenshot, paste one, or click to browse
          </div>
          <div className="mt-1 text-[11.5px] text-slate-500">
            PNG or JPG · the pitch view with all 15 players works best
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
      )}

      {phase === "reading" && (
        <div className="rounded-xl border border-pitch-700 px-4 py-6">
          <div className="mb-2 text-[13px] font-semibold text-slate-300">
            Reading your screenshot… {progress}%
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-pitch-700">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${Math.max(4, progress)}%` }}
            />
          </div>
          <p className="mt-2 text-[11.5px] text-slate-500">
            First run downloads the OCR engine, so it can take a few seconds.
          </p>
        </div>
      )}

      {phase === "error" && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-300">
          {error}
        </div>
      )}

      {phase === "review" && (
        <div>
          <div className="mb-3 rounded-xl border border-pitch-700 bg-pitch-900/50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div>
                <div className="text-[13px] font-bold text-white">
                  Step 2 — check what we read, then add them
                </div>
                <div className="text-[11.5px] text-slate-500">
                  Untick anything that is not one of your players. Only the first legal 15 are
                  added.
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map((pos) => (
                  <span
                    key={pos}
                    className={cn(
                      "num rounded px-2 py-1 text-[11px] font-bold",
                      plan.counts[pos] === QUOTA[pos]
                        ? "bg-brand-500/20 text-brand-400"
                        : "bg-pitch-800 text-slate-400",
                    )}
                  >
                    {POS_SHORT[pos]} {plan.counts[pos]}/{QUOTA[pos]}
                  </span>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  onImport(matches);
                  reset();
                }}
                disabled={!plan.total}
                className="ml-auto rounded-lg bg-brand-500 px-5 py-2.5 text-[13.5px] font-bold text-pitch-950 transition enabled:hover:bg-brand-400 disabled:opacity-40"
              >
                Add {plan.total} player{plan.total === 1 ? "" : "s"} to my squad →
              </button>
            </div>

            {plan.total < 15 && (
              <p className="mt-2 text-[11.5px] text-amber-300">
                That is {15 - plan.total} short of a full squad — add the rest by searching below.
              </p>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <ul className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
              {matches.map((m, i) => {
                const skipped = plan.status.get(i);
                const included = m.selected && m.player && !skipped;
                return (
                  <li
                    key={`${m.line}-${i}`}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-2",
                      included
                        ? m.confident
                          ? "bg-pitch-900/60"
                          : "bg-amber-500/10"
                        : "bg-pitch-900/25 opacity-60",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={m.selected}
                      onChange={(e) =>
                        setMatches((prev) =>
                          prev.map((x, j) =>
                            j === i ? { ...x, selected: e.target.checked } : x,
                          ),
                        )
                      }
                      className="h-3.5 w-3.5 shrink-0 accent-brand-500"
                      aria-label={`Include ${m.player?.name ?? m.line}`}
                    />
                    <code className="w-20 shrink-0 truncate text-[11px] text-slate-500">
                      {m.line}
                    </code>
                    <span className="text-slate-600">→</span>
                    {m.player ? (
                      <>
                        <PositionBadge pos={m.player.pos} />
                        <span className="text-[13px] font-semibold text-white">
                          {m.player.name}
                        </span>
                        <span className="text-[11px] text-slate-500">{m.player.team}</span>
                        <span className="num ml-auto shrink-0 text-[12px] text-slate-400">
                          {money(m.player.cost)}
                        </span>
                      </>
                    ) : (
                      <span className="ml-auto text-[12.5px] text-slate-500">No match</span>
                    )}
                    {skipped && (
                      <span className="shrink-0 rounded bg-pitch-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                        {skipped}
                      </span>
                    )}
                    <CorrectionPicker
                      players={players}
                      line={m.line}
                      onPick={(id) => replace(i, id)}
                    />
                  </li>
                );
              })}
            </ul>

            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Uploaded screenshot"
                className="max-h-[420px] rounded-lg border border-pitch-700 object-contain"
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Inline dropdown for fixing a line the OCR got wrong. */
function CorrectionPicker({
  players,
  line,
  onPick,
}: {
  players: PlayerRow[];
  line: string;
  onPick: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded px-1.5 text-[11px] font-semibold text-slate-500 transition hover:text-brand-400"
      >
        Change
      </button>
    );
  }

  // Rank the whole pool by how close it is to what the OCR read.
  const options = players
    .map((p) => ({ p, m: matchLine(line, [p]) }))
    .sort((a, b) => (b.m?.score ?? 0) - (a.m?.score ?? 0))
    .slice(0, 60)
    .map((x) => x.p);

  return (
    <select
      autoFocus
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) onPick(Number(e.target.value));
        setOpen(false);
      }}
      onBlur={() => setOpen(false)}
      className="h-7 max-w-[190px] shrink-0 rounded border border-pitch-600 bg-pitch-900 px-1 text-[12px] text-slate-200 outline-none"
    >
      <option value="">Pick a player…</option>
      {options.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({p.pos} · {p.team})
        </option>
      ))}
    </select>
  );
}
