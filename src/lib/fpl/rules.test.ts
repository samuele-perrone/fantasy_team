import { describe, expect, it } from "vitest";
import { bootstrap } from "@/test/factories";
import { DEFAULT_RULES, describeRules, formationsFor, readRules, ruleDrift } from "./rules";

describe("squad rules", () => {
  it("falls back to the defaults when FPL publishes none", () => {
    expect(readRules(bootstrap([]).bootstrap)).toBe(DEFAULT_RULES);
  });

  it("reads what FPL publishes", () => {
    const bs = bootstrap([]).bootstrap;
    bs.element_types = [
      { id: 1, singular_name_short: "GKP", squad_select: 2, squad_min_play: 1, squad_max_play: 1 },
      { id: 2, singular_name_short: "DEF", squad_select: 5, squad_min_play: 3, squad_max_play: 5 },
      { id: 3, singular_name_short: "MID", squad_select: 5, squad_min_play: 2, squad_max_play: 5 },
      { id: 4, singular_name_short: "FWD", squad_select: 3, squad_min_play: 1, squad_max_play: 3 },
    ];
    bs.game_settings = {
      squad_squadsize: 15,
      squad_squadplay: 11,
      squad_team_limit: 4,
      squad_total_spend: 1050,
      transfers_sell_on_fee: 0.5,
      max_extra_free_transfers: 4,
    };
    const rules = readRules(bs);
    expect(rules.teamLimit).toBe(4);
    expect(rules.budget).toBe(105);
    expect(rules.maxRollover).toBe(5);
    expect(ruleDrift(rules)).toEqual(["per-club limit 3 → 4", "budget £100m → £105m"]);
  });

  it("lists the eight legal formations", () => {
    expect(formationsFor(DEFAULT_RULES)).toEqual([
      [3, 4, 3], [3, 5, 2], [4, 3, 3], [4, 4, 2], [4, 5, 1], [5, 2, 3], [5, 3, 2], [5, 4, 1],
    ]);
  });

  it("describes the rules in a line", () => {
    expect(describeRules(DEFAULT_RULES)).toBe("15 players (2/5/5/3), max 3 per club, £100.0m budget");
  });
});
