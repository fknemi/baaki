"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What's MSMED interest?",
  "How does the forecast work?",
  "Who should I chase first?",
  "What's a Bill of Supply?",
];

export default function HelpPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (trimmed.length > 500) {
      setError("500 character max per message.");
      return;
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
      let acc = "";

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
              acc += obj.text;
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
    <main className="flex min-h-screen flex-col p-4 pb-24">
      <h1 className="text-xl font-semibold">Help</h1>
      <p className="mt-1 text-xs text-[#5A6170]">
        Ask anything about receivables, GST, or how Baaki works. Confirm any
        tax decision with your CA.
      </p>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#5A6170]">Try asking:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full rounded-lg bg-white p-2 text-left text-xs ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA]"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg p-3 text-xs ${
              m.role === "user"
                ? "ml-12 bg-[#0F5C4E] text-white"
                : "mr-12 bg-white ring-1 ring-[#E4E7EC]"
            }`}
          >
            {m.content || (busy && i === messages.length - 1 ? "…" : "")}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && <p className="mt-2 text-xs text-[#B42318]">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder="Ask a question…"
          disabled={busy}
          className="flex-1 rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg bg-[#0F5C4E] px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </main>
  );
}
