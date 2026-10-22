import { describe, expect, it } from "vitest";
import { THEME_SCRIPT } from "./theme-toggle";

/** Run the pre-paint script against a fake browser and return the theme it set. */
function run({ saved, systemLight, storageThrows = false }: { saved: string | null; systemLight: boolean; storageThrows?: boolean }) {
  const root = { dataset: {} as Record<string, string> };
  const localStorage = {
    getItem: () => {
      if (storageThrows) throw new Error("blocked");
      return saved;
    },
  };
  const matchMedia = (q: string) => ({ matches: q.includes("light") && systemLight });
  new Function("localStorage", "matchMedia", "document", THEME_SCRIPT)(localStorage, matchMedia, {
    documentElement: root,
  });
  return root.dataset.theme;
}

describe("THEME_SCRIPT", () => {
  it("follows the system setting when nothing is saved", () => {
    expect(run({ saved: null, systemLight: true })).toBe("light");
    expect(run({ saved: null, systemLight: false })).toBe("dark");
  });

  it("uses a saved choice over the system setting", () => {
    expect(run({ saved: "dark", systemLight: true })).toBe("dark");
    expect(run({ saved: "light", systemLight: false })).toBe("light");
  });

  it("ignores a saved value it does not recognise", () => {
    expect(run({ saved: "sepia", systemLight: true })).toBe("light");
  });

  it("still follows the system when storage is blocked, as in some private modes", () => {
    expect(run({ saved: null, systemLight: true, storageThrows: true })).toBe("light");
  });
});
