"use client";

import { useEffect, useSyncExternalStore } from "react";

export type ThemeChoice = "system" | "light" | "dark";

const KEY = "theme";
const ORDER: ThemeChoice[] = ["system", "light", "dark"];
const LABEL: Record<ThemeChoice, string> = { system: "System", light: "Light", dark: "Dark" };

/**
 * Runs in <head> before the first paint, so the page never flashes the wrong theme. Kept as a
 * string because it must be inline: a bundled script would run after the page has painted.
 */
export const THEME_SCRIPT = `(function(){var c=null;try{c=localStorage.getItem("${KEY}")}catch(e){}var t=c==="light"||c==="dark"?c:(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.dataset.theme=t})()`;

function read(): ThemeChoice {
  try {
    const c = localStorage.getItem(KEY);
    return c === "light" || c === "dark" ? c : "system";
  } catch {
    return "system";
  }
}

function apply(choice: ThemeChoice) {
  const light =
    choice === "light" ||
    (choice === "system" && matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.dataset.theme = light ? "light" : "dark";
}

const ICONS: Record<ThemeChoice, React.ReactNode> = {
  system: (
    <>
      <rect x="3.5" y="4.5" width="17" height="11.5" rx="2" />
      <path d="M8.5 20h7M12 16v4" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
    </>
  ),
  dark: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
};

const CHANGED = "themechange";

function subscribe(onChange: () => void) {
  // "storage" fires when another tab changes the choice; CHANGED when this one does.
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

/** Cycles System → Light → Dark. System follows the phone or computer, live. */
export function ThemeToggle() {
  // The server cannot see localStorage, so it renders "system"; React swaps in the saved
  // choice straight after hydration without a mismatch.
  const choice = useSyncExternalStore(subscribe, read, () => "system" as ThemeChoice);

  useEffect(() => {
    if (choice !== "system") return;
    const media = matchMedia("(prefers-color-scheme: light)");
    const follow = () => apply("system");
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, [choice]);

  const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];

  return (
    <button
      type="button"
      onClick={() => {
        try {
          if (next === "system") localStorage.removeItem(KEY);
          else localStorage.setItem(KEY, next);
        } catch {
          // Private mode: the choice lasts for this page only.
        }
        apply(next);
        window.dispatchEvent(new Event(CHANGED));
      }}
      aria-label={`Theme: ${LABEL[choice]}. Switch to ${LABEL[next]}`}
      title={`Theme: ${LABEL[choice]}`}
      className="grid h-8 w-8 place-items-center rounded-lg border border-pitch-600 text-slate-300 transition hover:border-brand-500 hover:text-white"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {ICONS[choice]}
      </svg>
    </button>
  );
}
