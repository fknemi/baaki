"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What's MSMED interest?",
  "How does the forecast work?",
  "Who should I chase first?",
  "What's a Bill of Supply?",
];

// ─── outline icon ────────────────────────────────────────────────────────────
// Capped at h-4 (16 px) on lg/xl. The Send button's caller used
// `<IconArrowRight className="h-3.5 w-3.5" />` — that replaces the default
// and pins the glyph at 14 px forever. It now merges via the responsive
// default ladder.

const ICON_STD =
  "h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";

function IconArrowRight({ className = ICON_STD }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// ─── shared styles ───────────────────────────────────────────────────────────

// Suggestion chip — full-width button, scales padding and text together.
const SUGGESTION_CHIP =
  "help-suggestion block w-full text-left transition-colors duration-150 " +
  "rounded-lg border border-white/10 bg-[#171717]/20 text-white hover:bg-white/5 active:scale-[0.99] " +
  "p-2 text-xs " +
  "sm:p-2.5 sm:text-sm " +
  "md:p-3 md:rounded-xl md:text-sm " +
  "lg:p-3 lg:rounded-xl lg:text-base " +
  "xl:p-4 xl:rounded-xl xl:text-base";

// Message bubble base — role-agnostic chrome (radius + padding + text).
// Role-specific left/right margins are applied per-call so the indents
// can differ and grow independently.
const BUBBLE_BASE =
  "help-bubble break-words whitespace-pre-wrap " +
  "rounded-lg p-3 text-xs " +
  "sm:rounded-lg sm:p-3 sm:text-xs " +
  "md:rounded-xl md:p-3.5 md:text-sm " +
  "lg:rounded-xl lg:p-4 lg:text-sm " +
  "xl:rounded-xl xl:p-4 xl:text-base";

// Input field — box AND text scale together so a 48 px input at xl never
// holds a 14 px placeholder (the input-group rule from the OCR / MarkPaid
// passes).
const INPUT_FIELD =
  "flex-1 rounded-lg border border-white/10 bg-[#171717]/20 text-white " +
  "placeholder:text-white/30 transition-shadow duration-150 " +
  "focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50 " +
  "h-9 px-3 text-sm " +
  "sm:h-10 sm:rounded-lg sm:px-3.5 sm:text-sm " +
  "md:h-11 md:rounded-xl md:px-4 md:text-base " +
  "lg:h-12 lg:rounded-xl lg:px-4 lg:text-base " +
  "xl:h-12 xl:rounded-xl xl:px-5 xl:text-lg";

// Send button — shares the h-* ladder with the input so the two sides of
// the form row stay the same height at every breakpoint.
const SEND_BTN =
  "flex items-center justify-center font-medium text-white transition-transform duration-150 " +
  "hover:bg-[#0F5C4E]/90 active:scale-95 disabled:opacity-50 " +
  "h-9 gap-1.5 rounded-lg bg-[#0F5C4E] px-3 text-xs " +
  "sm:h-10 sm:gap-1.5 sm:rounded-lg sm:px-3.5 sm:text-sm " +
  "md:h-11 md:gap-2 md:rounded-xl md:px-4 md:text-sm " +
  "lg:h-12 lg:gap-2 lg:rounded-xl lg:px-5 lg:text-base " +
  "xl:h-12 xl:gap-2.5 xl:rounded-xl xl:px-5 xl:text-base";

// Flight clone — same text ladder as the input so the "typed text flying
// up" illusion holds at every breakpoint. Slightly smaller than the
// input's text on purpose (visual "lift-off" effect).
const FLIGHT_CLONE =
  "help-flight-clone pointer-events-none fixed z-50 truncate rounded-lg bg-[#0F5C4E] text-white shadow-lg " +
  "px-3 py-2 text-xs " +
  "sm:px-3.5 sm:py-2 sm:text-xs " +
  "md:px-4 md:py-2.5 md:text-sm " +
  "lg:px-4 lg:py-3 lg:text-sm " +
  "xl:px-5 xl:py-3 xl:text-base";

// A short-lived floating clone of whatever the user just typed. It's
// absolutely positioned at the input's screen location on mount, then a
// CSS animation carries it up to roughly where the new bubble will land.
// It never touches real layout — it's removed once the animation ends,
// by which point the real bubble is already sitting in the list under it.
type FlightState = {
  id: number;
  text: string;
  startTop: number;
  startLeft: number;
  startWidth: number;
  endTop: number;
};

export default function HelpPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flight, setFlight] = useState<FlightState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const flightIdRef = useRef(0);

  // Auto-scroll to the bottom on every message change and on stream
  // start/end. Instant while streaming (avoids queued smooth-scroll
  // animations when many tokens arrive), smooth otherwise.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: busy ? "auto" : "smooth",
    });
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (trimmed.length > 500) {
      setError("500 character max per message.");
      return;
    }

    // Capture the flight path before anything re-renders. If the form
    // isn't mounted (e.g. a suggestion chip was clicked, no input to fly
    // from) we just skip the flight and let the bubble animate in on its
    // own via the list's entrance animation.
    const formEl = formRef.current;
    const scrollEl = scrollRef.current;
    if (formEl && scrollEl) {
      const formRect = formEl.getBoundingClientRect();
      const scrollRect = scrollEl.getBoundingClientRect();
      const id = ++flightIdRef.current;
      setFlight({
        id,
        text: trimmed,
        startTop: formRect.top,
        startLeft: formRect.left,
        startWidth: formRect.width,
        // Land just above the bottom of the scroll viewport — roughly
        // where a freshly-appended bubble sits before the list auto-scrolls.
        endTop: scrollRect.bottom - 56,
      });
      // Matches the flight's CSS animation-duration below.
      window.setTimeout(() => {
        setFlight((f) => (f?.id === id ? null : f));
      }, 480);
    }

    setError(null);
    setInput("");
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setBusy(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-10) }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "Failed");
      }
      if (!res.body) throw new Error("No stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const accParts: string[] = [];

      setMessages([...next, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const obj = JSON.parse(payload);
            if (obj.text) {
              accParts.push(obj.text);
              const acc = accParts.join("");

              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = {
                  role: "assistant",
                  content: acc,
                };
                return copy;
              });
            }
          } catch {
            /* ignore malformed */
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setMessages(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    // mx-auto max-w-* — caps chat width on desktop for readability.
    // `h-[100dvh]` is preserved because the chat needs to fill the viewport
    // vertically. `md:max-w-3xl` / `xl:max-w-4xl` give the column a real
    // reading width without stretching to 1400px on a monitor, while
    // staying full-bleed on mobile where every px counts.
    <main className="mx-auto flex h-[100dvh] w-full flex-col pb-20 pt-14 md:max-w-3xl lg:max-w-4xl xl:max-w-4xl">
      <style jsx global>{`
        @keyframes help-fade-up {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes help-bubble-in {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.96);
          }
          60% {
            opacity: 1;
            transform: translateY(-1px) scale(1.01);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes help-typing-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes help-flight {
          0% {
            opacity: 1;
            transform: translate(0, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(var(--help-fly-x), var(--help-fly-y)) scale(0.82);
          }
        }

        .help-suggestion {
          opacity: 0;
          animation: help-fade-up 0.32s ease-out forwards;
        }

        .help-bubble {
          animation: help-bubble-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .help-typing {
          animation: help-typing-in 0.2s ease-out both;
        }

        .help-flight-clone {
          animation: help-flight 0.42s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .help-suggestion,
          .help-bubble,
          .help-typing,
          .help-flight-clone {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* Header — fixed at top */}
      <header className="shrink-0 px-3 pb-2 pt-4 sm:px-4 sm:pt-5 md:px-6 md:pt-6 lg:px-8 lg:pt-6 xl:px-8 xl:pt-8">
        <h1 className="text-xl font-semibold text-white sm:text-2xl md:text-2xl lg:text-3xl xl:text-4xl">
          Help
        </h1>
        <p className="mt-1 text-xs italic text-white sm:text-sm md:text-sm lg:text-base xl:text-base">
          Ask anything about receivables, GST, or how Baaki works. Confirm any
          tax decision with your CA.
        </p>
      </header>

      {/* Messages — takes remaining space, scrolls */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-2 sm:space-y-3 sm:px-4 md:space-y-4 md:px-6 lg:space-y-4 lg:px-8 xl:space-y-5 xl:px-8"
      >
        {messages.length === 0 && (
          <div className="space-y-2 sm:space-y-2 md:space-y-2.5 lg:space-y-3 xl:space-y-3">
            <p className="text-xs font-medium italic text-white sm:text-sm md:text-sm lg:text-base xl:text-base">
              Try asking:
            </p>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={s}
                onClick={() => send(s)}
                style={{ animationDelay: `${i * 70}ms` }}
                className={SUGGESTION_CHIP}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => {
          const isWaiting =
            busy &&
            i === messages.length - 1 &&
            m.role === "assistant" &&
            m.content.length === 0;

          // Role-specific left/right margins grow independently so on
          // mobile the indent stays tight (ml-6 = 24 px leaves ~312 px
          // of message width on a 360 px phone) while on xl it opens up
          // (ml-20 = 80 px) to keep the bubble readable at ~700 px.
          const roleClass =
            m.role === "user"
              ? `${BUBBLE_BASE} ml-6 bg-[#0F5C4E] text-white sm:ml-8 md:ml-12 lg:ml-16 xl:ml-20`
              : `${BUBBLE_BASE} mr-6 border border-white/10 text-white sm:mr-8 md:mr-12 lg:mr-16 xl:mr-20`;

          // Don't replay the entrance animation on every re-render as a
          // streaming assistant message grows — the `help-bubble` class
          // applies once because the key + role keep the same DOM node.
          return (
            <div key={i} className={roleClass}>
              {isWaiting ? (
                <span
                  className="help-typing inline-flex items-center gap-1 sm:gap-1 md:gap-1.5 lg:gap-1.5 xl:gap-2"
                  aria-label="Assistant is typing"
                >
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s] sm:h-2 sm:w-2 md:h-2 md:w-2 lg:h-2 lg:w-2 xl:h-2.5 xl:w-2.5" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s] sm:h-2 sm:w-2 md:h-2 md:w-2 lg:h-2 lg:w-2 xl:h-2.5 xl:w-2.5" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current sm:h-2 sm:w-2 md:h-2 md:w-2 lg:h-2 lg:w-2 xl:h-2.5 xl:w-2.5" />
                </span>
              ) : (
                m.content
              )}
            </div>
          );
        })}
      </div>

      {/* Input — fixed at bottom of the content area (above the nav) */}
      <div className="shrink-0 px-3 pt-3 sm:px-4 sm:pt-3 md:px-6 md:pt-4 lg:px-8 lg:pt-4 xl:px-8 xl:pt-5">
        {error && (
          <p className="mb-2 text-xs text-[#FF9B8F] sm:text-sm md:text-sm lg:text-base xl:text-base">
            {error}
          </p>
        )}
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2 sm:gap-2 md:gap-2.5 lg:gap-3 xl:gap-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            placeholder="Ask a question…"
            disabled={busy}
            className={INPUT_FIELD}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className={SEND_BTN}
          >
            <IconArrowRight />
            Send
          </button>
        </form>
      </div>

      {/* Flight clone: the text visually leaps from the input to the
          bottom of the chat list on send, then fades out right as the
          real bubble (already rendered underneath) settles into place.
          Text and padding scale with the input so the take-off doesn't
          look tiny on xl compared to the input it just left. */}
      {flight && (
        <div
          key={flight.id}
          className={FLIGHT_CLONE}
          style={
            {
              top: flight.startTop,
              left: flight.startLeft,
              width: flight.startWidth,
              "--help-fly-x": "0px",
              "--help-fly-y": `${flight.endTop - flight.startTop}px`,
            } as React.CSSProperties
          }
        >
          {flight.text}
        </div>
      )}
    </main>
  );
}
