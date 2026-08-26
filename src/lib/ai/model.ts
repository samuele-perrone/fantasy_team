import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Which Claude model answers squad questions.
 *
 * This talks to the Anthropic API directly with `ANTHROPIC_API_KEY`, rather than through the
 * Vercel AI Gateway. The gateway needs no key — it authenticates with the deployment's OIDC
 * token — but it serves models according to the Vercel *plan*, and a free plan is restricted
 * to `claude-3-haiku` and rate-limits it to roughly one request every few minutes. An
 * Anthropic key has no such gate, so the model is simply pinned here.
 *
 * Override with `FTH_AI_MODEL` to try a different one without a code change.
 */
const DEFAULT_MODEL = "claude-sonnet-5";

export function chatModel(): LanguageModel {
  return anthropic(process.env.FTH_AI_MODEL?.trim() || DEFAULT_MODEL);
}

/** True when the key is missing, so the UI can say so instead of failing at the gateway. */
export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}
