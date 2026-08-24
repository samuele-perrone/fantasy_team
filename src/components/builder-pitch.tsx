"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PlayerRow } from "@/lib/fpl/row";
import { cn, money, shirtUrl } from "@/lib/utils";

const POS_LABEL: Record<number, string> = {
  1: "Goalkeepers",
  2: "Defenders",
  3: "Midfielders",
  4: "Forwards",
};
const POS_SHORT = ["", "GKP", "DEF", "MID", "FWD"];

const MENU_WIDTH = 150;
const MENU_GAP = 6;

interface Slot {
  pos: number;
  player: PlayerRow | null;
}

interface MenuState {
  player: PlayerRow;
  isStarter: boolean;
  rect: DOMRect;
}

/**
 * The squad on a pitch: the starting eleven in the chosen shape on the grass, the four
 * substitutes on a bench strip below, and dashed placeholders wherever the 15 is short.
 */
export function BuilderPitch({
  starters,
  bench,
  grassShortfall,
  benchShortfall,
  formation,
  captain,
  vice,
  teamCodes,
  complete,
  squadSize,
  swapReason,
  onSetCaptain,
  onSetVice,
  onToggleStart,
  onRemove,
  onReplace,
  onPickEmpty,
}: {
  starters: PlayerRow[];
  bench: PlayerRow[];
  /** positions the chosen shape still needs on the pitch, one entry per empty slot */
  grassShortfall: number[];
  /** positions still missing from the 15 beyond what the pitch needs */
  benchShortfall: number[];
  formation: [number, number, number];
  captain: number | null;
  vice: number | null;
  teamCodes: Record<number, number>;
  complete: boolean;
  squadSize: number;
  swapReason: (id: number) => string | null;
  onSetCaptain: (id: number) => void;
  onSetVice: (id: number) => void;
  onToggleStart: (id: number) => void;
  onRemove: (id: number) => void;
  onReplace: (id: number) => void;
  onPickEmpty: (pos: number) => void;
}) {
  const [menu, setMenu] = useState<MenuState | null>(null);

  const rows: Slot[][] = [1, 2, 3, 4].map((pos) => [
    ...starters.filter((p) => p.posId === pos).map((player) => ({ pos, player })),
    ...grassShortfall.filter((x) => x === pos).map(() => ({ pos, player: null })),
  ]);

  const benchSlots: Slot[] = [
    ...bench
      .slice()
      .sort((a, b) => (a.posId === 1 ? 1 : 0) - (b.posId === 1 ? 1 : 0))
      .map((player) => ({ pos: player.posId, player })),
    ...benchShortfall.map((pos) => ({ pos, player: null })),
  ];

  const open = (slot: Slot, rect: DOMRect, isStarter: boolean) => {
    if (!slot.player) return onPickEmpty(slot.pos);
    setMenu(
      menu?.player.id === slot.player.id
        ? null
        : { player: slot.player, isStarter, rect },
    );
  };

  return (
    <div>
      <div
        className="relative overflow-hidden rounded-t-2xl border border-b-0 border-pitch-700 px-2 py-4"
        style={{
          backgroundColor: "#0e8a44",
          backgroundImage:
            "repeating-linear-gradient(180deg,rgba(255,255,255,.055) 0 42px,transparent 42px 84px)," +
            "linear-gradient(180deg,#12a352 0%,#0e8a44 55%,#0a6f37 100%)",
        }}
      >
        <PitchMarkings />

        <div className="relative flex items-center justify-between px-2 pb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">
            {complete ? `Starting XI · ${formation.join("-")}` : "Squad selection"}
          </span>
          <span className="num text-[10px] font-bold text-white/45">{squadSize}/15</span>
        </div>

        <div className="relative space-y-3">
          {rows.map((slots, i) => (
            <div key={i} className="flex flex-wrap items-start justify-center gap-x-1 gap-y-3">
              {slots.map((slot, j) => (
                <PitchSlot
                  key={slot.player?.id ?? `grass-${i}-${j}`}
                  slot={slot}
                  benched={false}
                  isCaptain={slot.player?.id === captain}
                  isVice={slot.player?.id === vice}
                  active={menu?.player.id === slot.player?.id}
                  teamCode={slot.player ? (teamCodes[slot.player.teamId] ?? 1) : 1}
                  onActivate={(rect) => open(slot, rect, true)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div
        className="rounded-b-2xl border border-t-0 border-pitch-700 px-2 py-3"
        style={{ backgroundColor: "#0a5c2f" }}
      >
        <div className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.14em] text-white/60">
          Bench
        </div>
        <div className="flex flex-wrap items-start justify-center gap-x-1 gap-y-3">
          {benchSlots.length ? (
            benchSlots.map((slot, i) => (
              <PitchSlot
                key={slot.player?.id ?? `bench-${i}`}
                slot={slot}
                benched
                isCaptain={slot.player?.id === captain}
                isVice={slot.player?.id === vice}
                active={menu?.player.id === slot.player?.id}
                teamCode={slot.player ? (teamCodes[slot.player.teamId] ?? 1) : 1}
                onActivate={(rect) => open(slot, rect, false)}
              />
            ))
          ) : (
            <p className="py-3 text-[12px] text-slate-600">
              Your four substitutes appear here once the squad is complete.
            </p>
          )}
        </div>
      </div>

      <p className="mt-2 text-[11.5px] text-slate-500">
        Tap a player for captain, bench and remove options. Tap an empty shirt to search for that
        position.
      </p>

      {menu && (
        <SlotMenu
          menu={menu}
          swapBlocked={swapReason(menu.player.id)}
          isCaptain={menu.player.id === captain}
          isVice={menu.player.id === vice}
          onClose={() => setMenu(null)}
          onSetCaptain={onSetCaptain}
          onSetVice={onSetVice}
          onToggleStart={onToggleStart}
          onRemove={onRemove}
          onReplace={onReplace}
        />
      )}
    </div>
  );
}

/**
 * The action menu is portalled to the body and fixed-positioned. The pitch clips its own
 * overflow to keep the grass inside its rounded corners, which would otherwise cut the menu
 * off at the bottom edge.
 */
function SlotMenu({
  menu,
  swapBlocked,
  isCaptain,
  isVice,
  onClose,
  onSetCaptain,
  onSetVice,
  onToggleStart,
  onRemove,
  onReplace,
}: {
  menu: MenuState;
  /** null when the player can be swapped, otherwise why not */
  swapBlocked: string | null;
  isCaptain: boolean;
  isVice: boolean;
  onClose: () => void;
  onSetCaptain: (id: number) => void;
  onSetVice: (id: number) => void;
  onToggleStart: (id: number) => void;
  onRemove: (id: number) => void;
  onReplace: (id: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: menu.rect.left,
    top: menu.rect.bottom + MENU_GAP,
  });

  // Measured rather than guessed, so the flip decision uses the real menu height.
  useLayoutEffect(() => {
    const height = ref.current?.offsetHeight ?? 150;
    const { rect } = menu;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - MENU_WIDTH / 2, 8),
      window.innerWidth - MENU_WIDTH - 8,
    );
    const below = rect.bottom + MENU_GAP;
    const top =
      below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - MENU_GAP) : below;
    setPos({ left, top });
  }, [menu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    // A fixed menu would drift away from its shirt on scroll, so dismiss instead.
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ position: "fixed", left: pos.left, top: pos.top, width: MENU_WIDTH }}
      className="z-[100] rounded-lg border border-pitch-600 bg-pitch-850 p-1 shadow-2xl shadow-black/70"
    >
      <div className="truncate border-b border-pitch-700 px-2 pb-1.5 pt-1 text-[11px] font-bold text-white">
        {menu.player.name}
        <span className="ml-1 font-normal text-slate-500">
          {POS_SHORT[menu.player.posId]} · {money(menu.player.cost)}
        </span>
      </div>
      <Action onClick={act(() => onSetCaptain(menu.player.id))} disabled={!menu.isStarter}>
        {isCaptain ? "Remove armband" : "Make captain"}
      </Action>
      <Action
        onClick={act(() => onSetVice(menu.player.id))}
        disabled={!menu.isStarter || isCaptain}
      >
        {isVice ? "Remove vice" : "Make vice"}
      </Action>
      <Action
        onClick={act(() => onToggleStart(menu.player.id))}
        disabled={Boolean(swapBlocked)}
        title={swapBlocked ?? undefined}
      >
        {menu.isStarter ? "Move to bench" : "Move into XI"}
      </Action>
      <Action onClick={act(() => onReplace(menu.player.id))}>
        Swap for next best
      </Action>
      <Action onClick={act(() => onRemove(menu.player.id))} tone="danger">
        Remove from squad
      </Action>
    </div>,
    document.body,
  );
}

function PitchSlot({
  slot,
  benched,
  isCaptain,
  isVice,
  active,
  teamCode,
  onActivate,
}: {
  slot: Slot;
  benched: boolean;
  isCaptain: boolean;
  isVice: boolean;
  active: boolean;
  teamCode: number;
  onActivate: (rect: DOMRect) => void;
}) {
  const p = slot.player;

  if (!p) {
    return (
      <button
        type="button"
        onClick={(e) => onActivate(e.currentTarget.getBoundingClientRect())}
        title={`Add a ${POS_LABEL[slot.pos].slice(0, -1).toLowerCase()}`}
        className="group w-[62px] shrink-0 text-center sm:w-[74px] md:w-[88px]"
      >
        <div className="mx-auto grid h-[46px] w-[40px] place-items-center rounded-md border-2 border-dashed border-white/25 text-white/40 transition group-hover:border-brand-400 group-hover:text-brand-400">
          <span className="text-[18px] leading-none">+</span>
        </div>
        <div className="mt-1 truncate rounded bg-black/35 px-1 text-[10px] font-semibold text-white/50">
          {POS_SHORT[slot.pos]}
        </div>
      </button>
    );
  }

  const unavailable = p.status !== "a";

  return (
    <button
      type="button"
      onClick={(e) => onActivate(e.currentTarget.getBoundingClientRect())}
      className={cn(
        "group w-[62px] shrink-0 rounded-lg text-center outline-none sm:w-[74px] md:w-[88px]",
        active && "ring-2 ring-brand-400",
      )}
    >
      <div className="relative mx-auto h-[46px] w-[40px]">
        <Image
          src={shirtUrl(teamCode, p.posId === 1)}
          alt=""
          width={40}
          height={46}
          unoptimized
          className={cn(
            "h-full w-full object-contain transition group-hover:scale-110",
            benched && "opacity-45 grayscale",
            unavailable && "opacity-55",
          )}
        />
        {isCaptain && <Armband label="C" />}
        {!isCaptain && isVice && <Armband label="V" muted />}
        {unavailable && (
          <span
            title={p.news}
            className={cn(
              "absolute -right-1 top-0 grid h-3.5 w-3.5 place-items-center rounded-full text-[8px] font-black text-white",
              p.status === "d" ? "bg-amber-500" : "bg-rose-500",
            )}
          >
            !
          </span>
        )}
      </div>

      <div className="mt-1 overflow-hidden rounded-[3px] shadow-[0_1px_2px_rgba(0,0,0,.3)]">
        <div
          className="truncate px-1 py-[3px] text-[10.5px] font-bold leading-tight text-white"
          style={{ backgroundColor: benched ? "#4a2350" : "#37003c" }}
        >
          {p.name}
        </div>
        <div
          className="num truncate px-1 py-[2px] text-[10px] font-black leading-tight"
          style={
            benched
              ? { backgroundColor: "#7fd8b0", color: "#37003c" }
              : { backgroundColor: "#00ff87", color: "#37003c" }
          }
        >
          {money(p.cost)}
        </div>
      </div>
    </button>
  );
}

function Action({
  children,
  onClick,
  disabled,
  tone,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "danger";
  title?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "block w-full rounded px-2 py-1.5 text-left text-[12px] font-semibold transition disabled:opacity-30",
        tone === "danger"
          ? "text-rose-400 enabled:hover:bg-rose-500/15"
          : "text-slate-300 enabled:hover:bg-pitch-700 enabled:hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function Armband({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "absolute -right-1.5 bottom-0 grid h-[17px] w-[17px] place-items-center rounded-full border-2 border-pitch-950 text-[9.5px] font-black",
        muted ? "bg-slate-300 text-pitch-950" : "bg-white text-pitch-950",
      )}
    >
      {label}
    </span>
  );
}

function PitchMarkings() {
  return (
    <svg
      viewBox="0 0 340 420"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.38]"
      aria-hidden
    >
      <g fill="none" stroke="#fff" strokeWidth="2">
        <rect x="5" y="5" width="330" height="410" />
        <rect x="88" y="5" width="164" height="66" />
        <rect x="132" y="5" width="76" height="28" />
        <circle cx="170" cy="52" r="1.8" fill="#fff" />
        <path d="M132 71 A 44 44 0 0 0 208 71" />
        <line x1="5" y1="415" x2="335" y2="415" />
        <circle cx="170" cy="415" r="52" />
      </g>
    </svg>
  );
}
