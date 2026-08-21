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
        className="relative overflow-hidden rounded-2xl border border-pitch-700 px-2 py-4"
        style={{ background: "linear-gradient(180deg,#0d2a1c 0%,#0f3323 45%,#0b2418 100%)" }}
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

      <div className="mt-2 rounded-2xl border border-pitch-700 bg-pitch-850 px-2 py-3">
        <div className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
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

      <div
        className={cn(
          "mt-1 truncate rounded-t px-1 text-[10.5px] font-bold",
          benched ? "bg-pitch-950/70 text-slate-400" : "bg-pitch-950/85 text-white",
        )}
      >
        {p.name}
      </div>
      <div
        className={cn(
          "num truncate rounded-b px-1 text-[10px] font-bold",
          benched ? "bg-pitch-600 text-slate-200" : "bg-brand-500 text-pitch-950",
        )}
      >
        {money(p.cost)}
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
      className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
      aria-hidden
    >
      <rect x="6" y="6" width="328" height="408" fill="none" stroke="#fff" strokeWidth="1.5" />
      <line x1="6" y1="210" x2="334" y2="210" stroke="#fff" strokeWidth="1.5" />
      <circle cx="170" cy="210" r="46" fill="none" stroke="#fff" strokeWidth="1.5" />
      <rect x="90" y="6" width="160" height="62" fill="none" stroke="#fff" strokeWidth="1.5" />
      <rect x="90" y="352" width="160" height="62" fill="none" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}
