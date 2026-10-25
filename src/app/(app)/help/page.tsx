"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What's MSMED interest?",
  "How does the forecast work?",
  "Who should I chase first?",
  "What's a Bill of Supply?",
];

function IconArrowRight({ className = "h-3.5 w-3.5" }: { className?: string }) {
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
    <main className="flex h-[100dvh] flex-col pb-20 pt-14">
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
      <header className="shrink-0 px-4 pb-2 pt-4">
        <h1 className="text-xl font-semibold text-white">Help</h1>
        <p className="mt-1 text-xs text-white italic">
          Ask anything about receivables, GST, or how Baaki works. Confirm any
          tax decision with your CA.
        </p>
      </header>

      {/* Messages — takes remaining space, scrolls */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-2"
      >
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-white italic">Try asking:</p>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={s}
                onClick={() => send(s)}
                style={{ animationDelay: `${i * 70}ms` }}
                className="help-suggestion block w-full rounded-lg border border-white/10 bg-[#171717]/20 p-2 text-left text-xs text-white transition-colors duration-150 hover:bg-white/5 active:scale-[0.99]"
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

          // Don't replay the entrance animation on every re-render as a
          // streaming assistant message grows — only the message that was
          // genuinely just appended (the final one, while still empty or
          // on its very first paint) should animate in. We key on index +
          // role so React treats it as the same node across content
          // updates, so the animation only plays once per bubble.
          return (
            <div
              key={i}
              className={`help-bubble break-words whitespace-pre-wrap rounded-lg p-3 text-xs ${
                m.role === "user"
                  ? "ml-12 bg-[#0F5C4E] text-white"
                  : "mr-12 border border-white/10 text-white"
              }`}
            >
              {isWaiting ? (
                <span
                  className="help-typing inline-flex items-center gap-1"
                  aria-label="Assistant is typing"
                >
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                </span>
              ) : (
                m.content
              )}
            </div>
          );
        })}
      </div>

      {/* Input — fixed at bottom of the content area (above the nav) */}
      <div className="shrink-0 px-4 pt-3">
        {error && <p className="mb-2 text-xs text-[#FF9B8F]">{error}</p>}
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            placeholder="Ask a question…"
            disabled={busy}
            className="flex-1 rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-sm text-white placeholder:text-white/30 transition-shadow duration-150 focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[#0F5C4E] px-4 py-2 text-xs font-medium text-white transition-transform duration-150 hover:bg-[#0F5C4E]/90 active:scale-95 disabled:opacity-50"
          >
            <IconArrowRight className="h-3.5 w-3.5" />
            Send
          </button>
        </form>
      </div>

      {/* Flight clone: the text visually leaps from the input to the
          bottom of the chat list on send, then fades out right as the
          real bubble (already rendered underneath) settles into place. */}
      {flight && (
        <div
          key={flight.id}
          className="help-flight-clone pointer-events-none fixed z-50 truncate rounded-lg bg-[#0F5C4E] px-3 py-2 text-xs text-white shadow-lg"
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
