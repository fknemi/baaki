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
// Three ladders: shield (trigger), sm (result headings), tiny (inline fine
// print). All capped at h-4 (16px) on lg/xl — going to h-5 was oversized,
// the same bug we hit on the invoice-detail action icons.

const ICON_SHIELD =
  "h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";
const ICON_SM =
  "h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";
const ICON_TINY =
  "h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4";

function IconShieldCheck({ className = ICON_SHIELD }: { className?: string }) {
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

function IconCheck({ className = ICON_SM }: { className?: string }) {
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

function IconX({ className = ICON_SM }: { className?: string }) {
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

function IconAlert({ className = ICON_SM }: { className?: string }) {
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
    <div className="self-start space-y-2 sm:space-y-2 md:space-y-2.5 lg:space-y-3 xl:space-y-3">
      <button
        onClick={onClick}
        disabled={busy}
        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#171717]/20 px-3 text-center text-xs font-medium text-white hover:bg-white/5 disabled:opacity-50 sm:h-11 sm:gap-1.5 sm:rounded-lg sm:px-4 sm:text-sm md:h-12 md:gap-2 md:rounded-xl md:px-4 md:text-base lg:h-12 lg:gap-2 lg:rounded-xl lg:px-5 lg:text-base xl:h-14 xl:gap-2.5 xl:rounded-xl xl:px-6 xl:text-lg"
      >
        <IconShieldCheck />
        {busy ? "Verifying on server and this device…" : "Verify this record"}
      </button>

      {result && (
        <div
          className={`rounded-lg border p-3 text-xs sm:rounded-lg sm:p-3 sm:text-xs md:rounded-xl md:p-4 md:text-sm lg:rounded-xl lg:p-4 lg:text-sm xl:rounded-xl xl:p-5 xl:text-base ${
            isGreen
              ? "border-[#067647]/40 bg-[#067647]/10 text-white"
              : "border-[#B42318]/40 bg-[#B42318]/10 text-white"
          }`}
        >
          {result.server.valid ? (
            <p className="flex items-center gap-1.5 font-semibold sm:gap-1.5 md:gap-2 lg:gap-2 xl:gap-2.5">
              <IconCheck className={`${ICON_SM} shrink-0 text-[#4ADE80]`} />
              Chain verified, totals match
            </p>
          ) : chainBroken ? (
            <p className="flex items-center gap-1.5 font-semibold sm:gap-1.5 md:gap-2 lg:gap-2 xl:gap-2.5">
              <IconX className={`${ICON_SM} shrink-0 text-[#FF9B8F]`} />
              Chain broken
            </p>
          ) : (
            <p className="flex items-center gap-1.5 font-semibold sm:gap-1.5 md:gap-2 lg:gap-2 xl:gap-2.5">
              <IconAlert className={`${ICON_SM} shrink-0 text-[#FBBF24]`} />
              Totals differ from the recorded event
            </p>
          )}

          {result.server.chain.valid ? (
            <p className="mt-1 italic text-white sm:mt-1 md:mt-1.5 lg:mt-1.5 xl:mt-2">
              {result.server.chain.eventCount} event
              {result.server.chain.eventCount === 1 ? "" : "s"} verified on server
            </p>
          ) : (
            <p className="mt-1 break-words font-mono text-white sm:mt-1 md:mt-1.5 lg:mt-1.5 xl:mt-2">
              Server: failed at chain_seq{" "}
              <span className="rounded bg-[#B42318]/40 px-1 py-0.5 font-bold text-white sm:px-1 md:px-1.5 lg:px-1.5 xl:px-2">
                {result.server.chain.failedAt}
              </span>{" "}
              — {result.server.chain.reason}
            </p>
          )}

          {totalsDrift && result.server.discrepancies.length > 0 && (
            <ul className="mt-1 max-h-48 list-disc overflow-y-auto pl-4 pr-1 font-mono text-white sm:mt-1 md:mt-1.5 md:max-h-56 md:pl-5 lg:mt-1.5 lg:pl-5 xl:mt-2 xl:max-h-64 xl:pl-6">
              {result.server.discrepancies.map((d, i) => (
                <li key={i} className="break-words">{d}</li>
              ))}
            </ul>
          )}

          <div className="mt-2 border-t border-white/10 pt-2 sm:mt-2 sm:pt-2 md:mt-2.5 md:pt-2.5 lg:mt-3 lg:pt-3 xl:mt-3 xl:pt-3">
            {result.clientError ? (
              <p className="text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                Client verification unavailable: {result.clientError}
              </p>
            ) : result.client?.valid && clientMatches ? (
              <p className="flex items-start gap-1.5 text-[10px] text-white sm:gap-1.5 sm:text-[11px] md:gap-2 md:text-xs lg:gap-2 lg:text-xs xl:gap-2 xl:text-sm">
                <IconCheck className={`${ICON_TINY} mt-0.5 shrink-0 text-[#4ADE80]`} />
                <span>
                  Independently recomputed on this device. Anchors match:
                  <span className="ml-1 font-mono">
                    {result.client.anchor.slice(0, 12)}…
                  </span>
                </span>
              </p>
            ) : result.client?.valid ? (
              <p className="flex items-start gap-1.5 font-mono text-[10px] text-white sm:gap-1.5 sm:text-[11px] md:gap-2 md:text-xs lg:gap-2 lg:text-xs xl:gap-2 xl:text-sm">
                <IconAlert className={`${ICON_TINY} mt-0.5 shrink-0 text-[#FBBF24]`} />
                <span className="break-all">
                  Anchor mismatch. Server: {result.server.anchor.slice(0, 12)}…
                  Device: {result.client.anchor.slice(0, 12)}…
                </span>
              </p>
            ) : result.client ? (
              <p className="flex items-start gap-1.5 font-mono text-[10px] text-white sm:gap-1.5 sm:text-[11px] md:gap-2 md:text-xs lg:gap-2 lg:text-xs xl:gap-2 xl:text-sm">
                <IconX className={`${ICON_TINY} mt-0.5 shrink-0 text-[#FF9B8F]`} />
                <span className="break-words">
                  Client recompute failed at chain_seq {result.client.failedAt} —{" "}
                  {result.client.reason}
                </span>
              </p>
            ) : null}
          </div>

          <p className="mt-1 break-all font-mono text-[10px] text-white opacity-70 sm:mt-1 sm:text-[11px] md:mt-1.5 md:text-xs lg:mt-1.5 lg:text-xs xl:mt-2 xl:text-sm">
            anchor: {result.server.anchor.slice(0, 40)}…
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-[#FF9B8F] sm:text-xs md:text-sm lg:text-sm xl:text-base">
          {error}
        </p>
      )}
    </div>
  );
}
