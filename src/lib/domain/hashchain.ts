import { createHash } from "node:crypto";

export type ChainEvent = {
  seq: number;
  type: string;
  entityId: string;
  actor: string;
  atIso: string;
  payload: Record<string, unknown>;
};

export type StoredEvent = ChainEvent & {
  prevHash: string;
  hash: string;
};

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function canonicalJson(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of keys) ordered[k] = obj[k];
  return JSON.stringify(ordered);
}

export function genesisHash(): string {
  return sha256("GENESIS");
}

export function hashEvent(prevHash: string, event: ChainEvent): string {
  const canonical = canonicalJson({
    seq: event.seq,
    type: event.type,
    entityId: event.entityId,
    actor: event.actor,
    atIso: event.atIso,
    payload: event.payload,
  });
  return sha256(prevHash + canonical);
}

export function appendEvent(chain: StoredEvent[], event: Omit<ChainEvent, "seq">): StoredEvent[] {
  const prevHash = chain.length === 0 ? genesisHash() : chain[chain.length - 1]!.hash;
  const nextSeq = chain.length === 0 ? 1 : chain[chain.length - 1]!.seq + 1;
  const fullEvent: ChainEvent = { seq: nextSeq, ...event };
  const hash = hashEvent(prevHash, fullEvent);
  return [...chain, { ...fullEvent, prevHash, hash }];
}

export type VerifyResult = { valid: true } | { valid: false; failedAt: number };

export function verifyChain(chain: StoredEvent[]): VerifyResult {
  let expectedPrev = genesisHash();
  let expectedSeq = 1;

  for (const e of chain) {
    // Sequence continuity: a missing event shows up as "expected N, found M"
    if (e.seq !== expectedSeq) {
      return { valid: false, failedAt: expectedSeq };
    }
    // Hash linkage
    if (e.prevHash !== expectedPrev) {
      return { valid: false, failedAt: e.seq };
    }
    // Event integrity
    const expected = hashEvent(e.prevHash, {
      seq: e.seq,
      type: e.type,
      entityId: e.entityId,
      actor: e.actor,
      atIso: e.atIso,
      payload: e.payload,
    });
    if (expected !== e.hash) {
      return { valid: false, failedAt: e.seq };
    }

    expectedPrev = e.hash;
    expectedSeq++;
  }

  return { valid: true };
}
