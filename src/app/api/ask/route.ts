import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { getUserId } from "@/lib/supabase/server";
import { resolveTeam, EntryNotFound, InvalidSquad, type TeamQuery } from "@/lib/fpl/entry";
import { buildSquadBrief, SYSTEM_PROMPT } from "@/lib/ai/squad-brief";
import { chatModel, isConfigured } from "@/lib/ai/model";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Keep a runaway thread from quietly turning into a large bill. */
const MAX_MESSAGES = 24;
const MAX_CHARS = 2000;

export async function POST(req: Request) {
  // The proxy already gates page navigation, but an API route is reachable directly and every
  // call here spends money — so it is checked again rather than assumed.
  const userId = await getUserId();
  if (!userId) return new Response("Not signed in", { status: 401 });

  let body: { messages?: UIMessage[]; team?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  if (!isConfigured()) {
    return new Response(
      "Claude is not configured yet — add an ANTHROPIC_API_KEY environment variable.",
      { status: 503 },
    );
  }

  const messages = (body.messages ?? []).slice(-MAX_MESSAGES);
  if (!messages.length) return new Response("No messages", { status: 400 });

  const tooLong = messages.some((m) =>
    m.parts?.some((p) => p.type === "text" && p.text.length > MAX_CHARS),
  );
  if (tooLong) return new Response("Message too long", { status: 413 });

  // The client sends the same query string the page was rendered with, so the chat is
  // grounded in exactly the squad on screen — real entry or hand-built alike.
  const q = new URLSearchParams(body.team ?? "");
  const query: TeamQuery = {
    id: q.get("id") ?? undefined,
    squad: q.get("squad") ?? undefined,
    c: q.get("c") ?? undefined,
    v: q.get("v") ?? undefined,
    bank: q.get("bank") ?? undefined,
    name: q.get("name") ?? undefined,
    ft: q.get("ft") ?? undefined,
  };

  let brief: string;
  try {
    const team = await resolveTeam(query, 5);
    if (!team) return new Response("No squad loaded", { status: 400 });
    brief = buildSquadBrief(team);
  } catch (e) {
    if (e instanceof EntryNotFound || e instanceof InvalidSquad) {
      return new Response("Could not load that squad", { status: 400 });
    }
    throw e;
  }

  const result = streamText({
    model: chatModel(),
    system: `${SYSTEM_PROMPT}\n\n=== THE MANAGER'S SQUAD ===\n${brief}`,
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      // The default masks everything as "An error occurred", which hides the failures the
      // manager can actually act on. Order matters here: a rate-limit message can also
      // mention billing, so it has to be matched before any credit/quota wording or a
      // "wait a moment" problem gets reported as "go and pay someone".
      onError: (error) => {
        const message =
          error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
        if (/rate.?limit|429|overloaded/i.test(message)) {
          return "Claude is busy right now — give it a few seconds and ask again.";
        }
        if (/api.?key|authentication|unauthorized|401/i.test(message)) {
          return "The Claude API key is missing or rejected. Check ANTHROPIC_API_KEY.";
        }
        if (/credit|quota|billing|insufficient/i.test(message)) {
          return "The Claude account has no credit left. Top it up at console.anthropic.com and try again.";
        }
        return message;
      },
    }),
  });
}
