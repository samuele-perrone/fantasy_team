import { afterEach, describe, expect, it, vi } from "vitest";
import { chatModel, isConfigured } from "./model";

afterEach(() => vi.unstubAllEnvs());

describe("AI model config", () => {
  it("is configured only with a non-blank key", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "  ");
    expect(isConfigured()).toBe(false);
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-x");
    expect(isConfigured()).toBe(true);
  });

  it("can be overridden without a code change", () => {
    vi.stubEnv("FTH_AI_MODEL", "claude-haiku-4-5");
    expect((chatModel() as { modelId: string }).modelId).toBe("claude-haiku-4-5");
  });
});
