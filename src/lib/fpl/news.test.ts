import { describe, expect, it } from "vitest";
import { element } from "@/test/factories";
import {
  availabilityFor,
  flaggedNewsAdded,
  newsLabel,
  parseReturnDate,
  readNews,
  rowNewsLabel,
} from "./news";

const OCT = new Date("2026-10-20T12:00:00Z");

describe("parseReturnDate", () => {
  it("reads FPL's day-and-month format", () => {
    expect(parseReturnDate("Hamstring - Expected back 23 Nov", OCT)?.toISOString()).toBe(
      "2026-11-23T00:00:00.000Z",
    );
  });

  it("picks the year nearest today, so a December date read in January is last month", () => {
    const jan = new Date("2027-01-05T12:00:00Z");
    expect(parseReturnDate("Expected back 28 Dec", jan)?.getUTCFullYear()).toBe(2026);
  });

  it("returns null without a date or with a nonsense one", () => {
    expect(parseReturnDate("Knock - 75% chance of playing", OCT)).toBeNull();
    expect(parseReturnDate("Expected back 40 Nov", OCT)).toBeNull();
    expect(parseReturnDate("", OCT)).toBeNull();
  });
});

describe("readNews", () => {
  it("treats an injury with no date as indefinite", () => {
    const n = readNews(element({ status: "i", news: "Knee injury - Unknown return date" }), OCT);
    expect(n.indefinite).toBe(true);
    expect(n.returnDate).toBeNull();
  });

  it("clamps the chance of playing to 0–1", () => {
    expect(readNews(element({ chance_of_playing_next_round: 75 }), OCT).chance).toBe(0.75);
    expect(readNews(element({ chance_of_playing_next_round: null }), OCT).chance).toBeNull();
  });
});

describe("availabilityFor", () => {
  it("is 1 for a fit player", () => {
    expect(availabilityFor(element(), "2026-10-25T15:00:00Z", 0, OCT)).toBe(1);
  });

  it("rules out fixtures before the return date only, easing back in the first week", () => {
    const p = element({ status: "i", news: "Expected back 1 Nov", chance_of_playing_next_round: 0 });
    expect(availabilityFor(p, "2026-10-25T15:00:00Z", 0, OCT)).toBe(0);
    expect(availabilityFor(p, "2026-11-03T15:00:00Z", 1, OCT)).toBe(0.65);
    expect(availabilityFor(p, "2026-11-20T15:00:00Z", 3, OCT)).toBe(1);
  });

  it("rules out the whole horizon for an injury with no return date", () => {
    const p = element({ status: "i", news: "Unknown return date", chance_of_playing_next_round: 0 });
    expect(availabilityFor(p, "2026-12-25T15:00:00Z", 6, OCT)).toBe(0);
  });

  it("treats a suspension as one match", () => {
    const p = element({ status: "s", news: "Suspended until 26 Oct", chance_of_playing_next_round: 0 });
    expect(availabilityFor(p, "2026-10-25T15:00:00Z", 0, OCT)).toBe(0);
    expect(availabilityFor(p, "2026-11-01T15:00:00Z", 1, OCT)).toBe(1);
  });

  it("applies a published chance to the next round, recovering by a quarter a week", () => {
    const p = element({ status: "d", news: "Knock", chance_of_playing_next_round: 50 });
    expect(availabilityFor(p, null, 0, OCT)).toBe(0.5);
    expect(availabilityFor(p, null, 1, OCT)).toBe(0.75);
    expect(availabilityFor(p, null, 3, OCT)).toBe(1);
  });
});

describe("labels", () => {
  it("summarises the news in a few words", () => {
    expect(newsLabel(element(), OCT)).toBeNull();
    expect(newsLabel(element({ status: "i", news: "Expected back 23 Nov", chance_of_playing_next_round: 0 }), OCT)).toBe("back 23 Nov");
    expect(newsLabel(element({ status: "s", news: "Suspended", chance_of_playing_next_round: 0 }), OCT)).toBe("suspended");
    expect(newsLabel(element({ status: "d", news: "Knock", chance_of_playing_next_round: 75 }), OCT)).toBe("75% chance");
  });

  it("works from a flattened row too", () => {
    expect(rowNewsLabel({ status: "a", news: "", availability: null })).toBeNull();
    expect(rowNewsLabel({ status: "d", news: "Knock", availability: 50 })).toBe("50% chance");
    expect(rowNewsLabel({ status: "i", news: "Injured", availability: null })).toBe("out");
  });
});

describe("flaggedNewsAdded", () => {
  const added = "2026-10-22T09:30:00Z";
  const flagged = {
    status: "d",
    news: "Knee injury - 75% chance of playing",
    availability: 75,
    newsAdded: added,
  };

  it("gives the time for a flagged player's news", () => {
    expect(flaggedNewsAdded(flagged)).toBe(added);
    expect(flaggedNewsAdded({ ...flagged, status: "i", availability: 0 })).toBe(added);
  });

  it("is null once FPL has cleared the flag, though it keeps the time", () => {
    expect(flaggedNewsAdded({ status: "a", news: "", availability: null, newsAdded: added })).toBeNull();
    expect(flaggedNewsAdded({ status: "a", news: "Back in training", availability: 100, newsAdded: added })).toBeNull();
  });

  it("is null for a flag with no news to date", () => {
    expect(flaggedNewsAdded({ ...flagged, news: "" })).toBeNull();
  });
});
