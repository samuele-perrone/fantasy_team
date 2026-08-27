"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";

/** Openers that are worth a tap — the questions a manager actually opens the page to answer. */
const SUGGESTIONS = [
  "Who should I captain?",
  "Is it worth taking a hit this week?",
  "Which of my players should I move on?",
  "Should I use a chip yet?",
];

export function AskPanel({ teamQuery }: { teamQuery: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  // The squad is identified by the page's own query string, so the answer is always about
  // the squad on screen rather than a stale copy held server-side.
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/ask", body: { team: teamQuery } }),
    [teamQuery],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const scroller = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  // The trigger sits inline in the page header; the conversation opens over the page rather
  // than inside it, so an unopened panel costs no vertical space at all.
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-accent-400"
      >
        <Sparkle />
        Ask about your squad
      </button>
      {open && <Conversation onClose={() => setOpen(false)} {...{ messages, status, error, input, setInput, ask, scroller, busy }} />}
    </>
  );
}

interface ConversationProps {
  onClose: () => void;
  messages: ReturnType<typeof useChat>["messages"];
  status: ReturnType<typeof useChat>["status"];
  error: ReturnType<typeof useChat>["error"];
  input: string;
  setInput: (v: string) => void;
  ask: (text: string) => void;
  scroller: React.RefObject<HTMLDivElement | null>;
  busy: boolean;
}

function Conversation({
  onClose,
  messages,
  status,
  error,
  input,
  setInput,
  ask,
  scroller,
  busy,
}: ConversationProps) {
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <section className="panel fixed inset-x-3 bottom-3 z-50 flex max-h-[80vh] flex-col overflow-hidden shadow-2xl shadow-black/60 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[420px]">
      <div className="flex items-center gap-2 border-b border-pitch-800 px-4 py-3">
        <Sparkle />
        <h2 className="text-[14px] font-bold text-white">Ask about your squad</h2>
        <button
          onClick={onClose}
          className="ml-auto rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-400 transition hover:bg-pitch-800 hover:text-white"
        >
          Close
        </button>
      </div>

      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!messages.length && (
          <>
            <p className="text-[12.5px] leading-relaxed text-slate-400">
              It already knows your 15, your budget, your chips and what we expect every player
              to score. Ask anything.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-full border border-pitch-600 px-3 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:border-accent-400 hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-pitch-700 px-3.5 py-2 text-[13px] text-white"
                : "max-w-[92%] text-[13px] leading-relaxed text-slate-200"
            }
          >
            {m.parts.map((part, i) =>
              part.type === "text" ? (
                <span key={i} className="whitespace-pre-wrap">
                  {part.text}
                </span>
              ) : null,
            )}
          </div>
        ))}

        {status === "submitted" && (
          <div className="flex gap-1 text-slate-500" aria-label="Thinking">
            <Dot delay="0ms" />
            <Dot delay="150ms" />
            <Dot delay="300ms" />
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-300">
            {error.message || "Something went wrong. Try again."}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex gap-2 border-t border-pitch-800 px-3 py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          placeholder="Should I captain Haaland or Bruno?"
          className="min-w-0 flex-1 rounded-lg border border-pitch-600 bg-pitch-900 px-3 py-2 text-[13px] text-white placeholder:text-slate-600 focus:border-accent-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg bg-accent-500 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-accent-400 disabled:opacity-40"
        >
          Ask
        </button>
      </form>

      <p className="border-t border-pitch-800 px-4 py-2 text-[11px] text-slate-600">
        Answers use our projections, which are typically off by about 1.6 points per player per
        week. Treat them as a steer, not a certainty.
      </p>
      </section>
    </>
  );
}

function Sparkle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zM18.5 14l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z" />
    </svg>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
      style={{ animationDelay: delay }}
    />
  );
}
