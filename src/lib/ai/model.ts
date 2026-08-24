import "server-only";
import { generateText } from "ai";

/**
 * Which Claude model answers squad questions.
 *
 * The Vercel AI Gateway authenticates through the deployment's OIDC token, so there is no key
 * to manage — but the *account tier* decides which models it will serve, and a free tier is
 * restricted to older ones. Rather than pinning a model that 403s until someone tops up, or
 * pinning a weak one forever, this tries the best first and falls back.
 *
 * The practical effect: adding credits upgrades the answers with no code change and no
 * redeploy — the probe simply starts succeeding once the cache expires.
 */
const CANDIDATES = [
  "anthropic/claude-sonnet-5",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-haiku-4.5",
  "anthropic/claude-3-haiku",
] as const;

export interface ResolvedModel {
  id: string;
  /** true when we could not reach the preferred model and dropped to an older one */
  degraded: boolean;
}

let cached: { value: ResolvedModel; at: number } | null = null;

/** Re-probe this often, so a top-up is picked up without a deploy. */
const TTL_MS = 15 * 60 * 1000;

/**
 * A probe costs a request, and a rate-limited tier is exactly where requests are scarce — so
 * walking the whole list on every question is self-defeating. The result is cached, and a
 * failed probe is remembered too, so the chain is walked at most once per TTL rather than
 * once per question.
 */
async function serves(id: string): Promise<boolean> {
  try {
    await generateText({ model: id, prompt: "hi", maxOutputTokens: 1 });
    return true;
  } catch {
    return false;
  }
}

export async function resolveModel(): Promise<ResolvedModel> {
  const override = process.env.FTH_AI_MODEL?.trim();
  if (override) return { id: override, degraded: false };

  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  for (const [i, id] of CANDIDATES.entries()) {
    // The preferred model needs no probe: try it for real and let the route surface any
    // error. Only once it has failed is it worth spending requests to find a fallback.
    if (i === 0) {
      const value: ResolvedModel = { id, degraded: false };
      if (await serves(id)) {
        cached = { value, at: Date.now() };
        return value;
      }
      continue;
    }
    if (await serves(id)) {
      const value: ResolvedModel = { id, degraded: true };
      cached = { value, at: Date.now() };
      return value;
    }
  }

  // Nothing answered. Return the preferred one anyway so the caller surfaces the real
  // gateway error rather than a vague "no model" of our own invention.
  const value: ResolvedModel = { id: CANDIDATES[0], degraded: false };
  cached = { value, at: Date.now() };
  return value;
}
