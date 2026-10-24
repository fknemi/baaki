import { GENESIS, canonicalEvent } from "./hashchain-common";

async function sha256(s: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Client hash verification needs a secure context (https or localhost).");
  }
  const bytes = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type ClientEvent = {
  chainSeq: number;
  type: string;
  entityId: string;
  actor: string;
  atIso: string;
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
};

export type ClientVerifyResult =
  | { valid: true; eventCount: number; anchor: string }
  | { valid: false; failedAt: number; reason: string; anchor: string };

export async function verifyChainClient(events: ClientEvent[]): Promise<ClientVerifyResult> {
  let expectedPrev = await sha256(GENESIS);
  let expectedSeq = 1;

  for (const e of events) {
    if (e.chainSeq !== expectedSeq) {
      return {
        valid: false,
        failedAt: expectedSeq,
        reason: "missing event",
        anchor: expectedPrev,
      };
    }
    if (e.prevHash !== expectedPrev) {
      return {
        valid: false,
        failedAt: e.chainSeq,
        reason: "prevHash mismatch",
        anchor: expectedPrev,
      };
    }
    const canonical = canonicalEvent({
      seq: e.chainSeq,
      type: e.type,
      entityId: e.entityId,
      actor: e.actor,
      atIso: e.atIso,
      payload: e.payload,
    });
    const expectedHash = await sha256(expectedPrev + canonical);
    if (expectedHash !== e.hash) {
      return {
        valid: false,
        failedAt: e.chainSeq,
        reason: "hash mismatch",
        anchor: expectedPrev,
      };
    }
    expectedPrev = e.hash;
    expectedSeq++;
  }
  return { valid: true, eventCount: events.length, anchor: expectedPrev };
}
