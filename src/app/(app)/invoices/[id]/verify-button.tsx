"use client";

import { useState } from "react";
import {
  verifyChainClient,
  type ClientEvent,
  type ClientVerifyResult,
} from "@/lib/domain/hashchain-client";

type ServerChain =
  | { valid: true; eventCount: number; anchor: string }
  | { valid: false; failedAt: number; reason: string; anchor: string };

type ServerResult = {
  valid: boolean;
  chain: ServerChain;
  totalsMatch: boolean;
  discrepancies: string[];
  eventCount: number;
  anchor: string;
};

type Combined = {
  server: ServerResult;
  client: ClientVerifyResult | null;
  clientError: string | null;
};

// ─── outline icons ───────────────────────────────────────────────────────────

function IconShieldCheck({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function IconCheck({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconX({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconAlert({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function VerifyButton({ invoiceId }: { invoiceId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Combined | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const [serverRes, timelineRes] = await Promise.all([
        fetch(`/api/invoices/${invoiceId}/verify`),
        fetch(`/api/events/timeline/${invoiceId}`),
      ]);
      if (!serverRes.ok) throw new Error("Server verify failed");
      if (!timelineRes.ok) throw new Error("Timeline fetch failed");

      const serverData = (await serverRes.json()).data as ServerResult;
      const events = (await timelineRes.json()).data as ClientEvent[];

      let client: ClientVerifyResult | null = null;
      let clientError: string | null = null;
      try {
        client = await verifyChainClient(events);
      } catch (err) {
        clientError = err instanceof Error ? err.message : "Client verify failed";
      }

      setResult({ server: serverData, client, clientError });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify.");
    } finally {
      setBusy(false);
    }
  }

  const chainBroken = result !== null && !result.server.chain.valid;
  const totalsDrift = result !== null && result.server.chain.valid && !result.server.totalsMatch;
  const clientMatches =
    result !== null &&
    result.client !== null &&
    result.server.chain.valid &&
    result.client.valid &&
    result.client.anchor === result.server.anchor;

  const isGreen = result !== null && result.server.valid && (clientMatches || result.clientError !== null);

  return (
    // self-start keeps this trigger's height matched to its grid siblings
    // even after the result panel below expands — see mark-paid-button.tsx
    // for the full explanation of why this matters in a 2-col grid.
    <div className="self-start space-y-2">
      <button
        onClick={onClick}
        disabled={busy}
        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#171717]/20 px-4 text-xs font-medium text-white hover:bg-white/5 disabled:opacity-50"
      >
        <IconShieldCheck />
        {busy ? "Verifying on server and this device…" : "Verify this record"}
      </button>

      {result && (
        <div
          className={`rounded-lg border p-3 text-xs ${
            isGreen
              ? "border-[#067647]/40 bg-[#067647]/10 text-white"
              : "border-[#B42318]/40 bg-[#B42318]/10 text-white"
          }`}
        >
          {result.server.valid ? (
            <p className="flex items-center gap-1.5 font-semibold">
              <IconCheck className="h-3 w-3 shrink-0 text-[#4ADE80]" />
              Chain verified, totals match
            </p>
          ) : chainBroken ? (
            <p className="flex items-center gap-1.5 font-semibold">
              <IconX className="h-3 w-3 shrink-0 text-[#FF9B8F]" />
              Chain broken
            </p>
          ) : (
            <p className="flex items-center gap-1.5 font-semibold">
              <IconAlert className="h-3 w-3 shrink-0 text-[#FBBF24]" />
              Totals differ from the recorded event
            </p>
          )}

          {result.server.chain.valid ? (
            <p className="mt-1 text-white italic">
              {result.server.chain.eventCount} event
              {result.server.chain.eventCount === 1 ? "" : "s"} verified on server
            </p>
          ) : (
            <p className="mt-1 font-mono text-white">
              Server: failed at chain_seq{" "}
              <span className="rounded bg-[#B42318]/40 px-1 py-0.5 font-bold text-white">
                {result.server.chain.failedAt}
              </span>{" "}
              — {result.server.chain.reason}
            </p>
          )}

          {totalsDrift && result.server.discrepancies.length > 0 && (
            <ul className="mt-1 max-h-48 list-disc overflow-y-auto pl-4 pr-1 font-mono text-white">
              {result.server.discrepancies.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}

          <div className="mt-2 border-t border-white/10 pt-2">
            {result.clientError ? (
              <p className="text-[10px] italic text-white">
                Client verification unavailable: {result.clientError}
              </p>
            ) : result.client?.valid && clientMatches ? (
              <p className="flex items-start gap-1.5 text-[10px] text-white">
                <IconCheck className="mt-0.5 h-2.5 w-2.5 shrink-0 text-[#4ADE80]" />
                <span>
                  Independently recomputed on this device. Anchors match:
                  <span className="ml-1 font-mono">
                    {result.client.anchor.slice(0, 12)}…
                  </span>
                </span>
              </p>
            ) : result.client?.valid ? (
              <p className="flex items-start gap-1.5 font-mono text-[10px] text-white">
                <IconAlert className="mt-0.5 h-2.5 w-2.5 shrink-0 text-[#FBBF24]" />
                <span>
                  Anchor mismatch. Server: {result.server.anchor.slice(0, 12)}…
                  Device: {result.client.anchor.slice(0, 12)}…
                </span>
              </p>
            ) : result.client ? (
              <p className="flex items-start gap-1.5 font-mono text-[10px] text-white">
                <IconX className="mt-0.5 h-2.5 w-2.5 shrink-0 text-[#FF9B8F]" />
                <span>
                  Client recompute failed at chain_seq {result.client.failedAt} —{" "}
                  {result.client.reason}
                </span>
              </p>
            ) : null}
          </div>

          <p className="mt-1 break-all font-mono text-[10px] text-white opacity-70">
            anchor: {result.server.anchor.slice(0, 40)}…
          </p>
        </div>
      )}

      {error && <p className="text-xs text-[#FF9B8F]">{error}</p>}
    </div>
  );
}
