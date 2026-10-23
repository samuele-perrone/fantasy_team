import { afterEach, describe, expect, it, vi } from "vitest";
import { allowedEmails, allowlistUnconfigured, isAllowed } from "./allowlist";

afterEach(() => vi.unstubAllEnvs());

describe("allow-list", () => {
  it("fails closed when unset or empty", () => {
    vi.stubEnv("ALLOWED_EMAILS", "");
    expect(allowlistUnconfigured()).toBe(true);
    expect(isAllowed("anyone@example.com")).toBe(false);
  });

  it("denies a missing email", () => {
    vi.stubEnv("ALLOWED_EMAILS", "a@example.com");
    expect(isAllowed(null)).toBe(false);
    expect(isAllowed(undefined)).toBe(false);
  });

  it("accepts commas, semicolons, spaces, real newlines and escaped ones", () => {
    vi.stubEnv("ALLOWED_EMAILS", "a@x.com, b@x.com;c@x.com\nd@x.com\\ne@x.com");
    expect(allowedEmails()).toEqual(["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com"]);
    expect(isAllowed("e@x.com")).toBe(true);
  });

  it("treats Gmail dots and +tags as the same account", () => {
    vi.stubEnv("ALLOWED_EMAILS", "sam.p@gmail.com");
    expect(isAllowed("SAMP+fpl@googlemail.com")).toBe(true);
    expect(isAllowed("sam.q@gmail.com")).toBe(false);
  });

  it("keeps dots significant outside Gmail but still drops +tags", () => {
    vi.stubEnv("ALLOWED_EMAILS", "first.last@work.com");
    expect(isAllowed("first.last+x@work.com")).toBe(true);
    expect(isAllowed("firstlast@work.com")).toBe(false);
  });

  it("admits a whole domain from a bare @domain entry", () => {
    vi.stubEnv("ALLOWED_EMAILS", "@club.org");
    expect(isAllowed("anyone@club.org")).toBe(true);
    expect(isAllowed("anyone@other.org")).toBe(false);
  });

  it("admits every signed-in account when the list holds *, alongside named entries", () => {
    vi.stubEnv("ALLOWED_EMAILS", "a@example.com, *");
    expect(isAllowed("stranger@elsewhere.org")).toBe(true);
    expect(isAllowed("relay@privaterelay.appleid.com")).toBe(true);
  });

  it("still needs an email with *, and a * inside an address opens nothing", () => {
    vi.stubEnv("ALLOWED_EMAILS", "*");
    expect(isAllowed(null)).toBe(false);
    vi.stubEnv("ALLOWED_EMAILS", "a*@example.com");
    expect(isAllowed("stranger@elsewhere.org")).toBe(false);
  });
});
