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

  return (
    <div className="space-y-2">
      <button
        onClick={onClick}
        disabled={busy}
        className="w-full rounded-lg bg-white px-4 py-3 text-sm font-medium ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA] disabled:opacity-50"
      >
        {busy ? "Verifying on server and this device…" : "✓ Verify this record"}
      </button>

      {result && (
        <div
          className={`rounded-lg p-3 text-xs ring-1 ${
            result.server.valid && (clientMatches || result.clientError)
              ? "bg-green-50 text-green-900 ring-green-200"
              : "bg-red-50 text-red-900 ring-red-200"
          }`}
        >
          <p className="font-semibold">
            {result.server.valid
              ? chainBroken
                ? ""
                : "✓ Chain verified, totals match"
              : chainBroken
                ? "✗ Chain broken"
                : "⚠ Totals differ from the recorded event"}
          </p>

          {result.server.chain.valid ? (
            <p className="mt-1">
              {result.server.chain.eventCount} event
              {result.server.chain.eventCount === 1 ? "" : "s"} verified on server
            </p>
          ) : (
            <p className="mt-1 font-mono">
              Server: failed at chain_seq{" "}
              <span className="rounded bg-red-200 px-1 py-0.5 font-bold">
                {result.server.chain.failedAt}
              </span>{" "}
              — {result.server.chain.reason}
            </p>
          )}

          {totalsDrift && result.server.discrepancies.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {result.server.discrepancies.map((d, i) => (
                <li key={i} className="font-mono">
                  {d}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 border-t border-current/20 pt-2">
            {result.clientError ? (
              <p className="text-[10px] italic">
                Client verification unavailable: {result.clientError}
              </p>
            ) : result.client?.valid && clientMatches ? (
              <p className="text-[10px]">
                ✓ Independently recomputed on this device. Anchors match:
                <span className="ml-1 font-mono">{result.client.anchor.slice(0, 12)}…</span>
              </p>
            ) : result.client?.valid ? (
              <p className="font-mono text-[10px]">
                ⚠ Anchor mismatch. Server: {result.server.anchor.slice(0, 12)}… Device:{" "}
                {result.client.anchor.slice(0, 12)}…
              </p>
            ) : result.client ? (
              <p className="font-mono text-[10px]">
                ✗ Client recompute failed at chain_seq {result.client.failedAt} —{" "}
                {result.client.reason}
              </p>
            ) : null}
          </div>

          <p className="mt-1 font-mono text-[10px] break-all opacity-70">
            anchor: {result.server.anchor.slice(0, 40)}…
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
