import { createHash } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { events } from "@/lib/db/schema";
import { GENESIS, canonicalEvent } from "@/lib/domain/hashchain-common";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function genesisHash(): string {
  return sha256(GENESIS);
}

export type AppendEventInput = {
  businessId: string;
  entityType: string;
  entityId: string;
  type: string;
  actor: string;
  atIso: string;
  payload: Record<string, unknown>;
};

export type StoredEvent = {
  chainSeq: number;
  type: string;
  entityId: string;
  actor: string;
  atIso: string;
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
};

export async function appendEventInTx(
  tx: Tx,
  input: AppendEventInput,
): Promise<StoredEvent> {
  const lockKey = `${input.businessId}:${input.entityId}`;
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

  const [last] = await tx
    .select()
    .from(events)
    .where(
      and(
        eq(events.businessId, input.businessId),
        eq(events.entityId, input.entityId),
      ),
    )
    .orderBy(desc(events.chainSeq))
    .limit(1);

  const chainSeq = (last?.chainSeq ?? 0) + 1;
  const prevHash = last?.hash ?? genesisHash();
  const canonical = canonicalEvent({
    seq: chainSeq,
    type: input.type,
    entityId: input.entityId,
    actor: input.actor,
    atIso: input.atIso,
    payload: input.payload,
  });
  const hash = sha256(prevHash + canonical);

  const [row] = await tx
    .insert(events)
    .values({
      businessId: input.businessId,
      entityType: input.entityType,
      entityId: input.entityId,
      type: input.type,
      actor: input.actor,
      atIso: new Date(input.atIso),
      payload: input.payload,
      prevHash,
      hash,
      chainSeq,
    })
    .returning();

  return {
    chainSeq: row!.chainSeq,
    type: row!.type,
    entityId: row!.entityId,
    actor: row!.actor,
    atIso: row!.atIso.toISOString(),
    payload: row!.payload as Record<string, unknown>,
    prevHash: row!.prevHash,
    hash: row!.hash,
  };
}

export async function appendEvent(
  input: AppendEventInput,
): Promise<StoredEvent> {
  return db.transaction((tx) => appendEventInTx(tx, input));
}

export async function listEntityEvents(
  businessId: string,
  entityId: string,
): Promise<StoredEvent[]> {
  const rows = await db
    .select()
    .from(events)
    .where(
      and(eq(events.businessId, businessId), eq(events.entityId, entityId)),
    )
    .orderBy(asc(events.chainSeq));

  return rows.map((r) => ({
    chainSeq: r.chainSeq,
    type: r.type,
    entityId: r.entityId,
    actor: r.actor,
    atIso: r.atIso.toISOString(),
    payload: r.payload as Record<string, unknown>,
    prevHash: r.prevHash,
    hash: r.hash,
  }));
}

export type VerifyResult =
  | { valid: true; eventCount: number; anchor: string }
  | { valid: false; failedAt: number; reason: string; anchor: string };

export async function verifyEntityChain(
  businessId: string,
  entityId: string,
): Promise<VerifyResult> {
  const chain = await listEntityEvents(businessId, entityId);
  let expectedPrev = genesisHash();
  let expectedSeq = 1;

  for (const e of chain) {
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
    if (sha256(expectedPrev + canonical) !== e.hash) {
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
  return { valid: true, eventCount: chain.length, anchor: expectedPrev };
}
