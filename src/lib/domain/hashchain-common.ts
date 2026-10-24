export const GENESIS = "GENESIS";

export function canonicalJson(v: unknown): string {
  if (v === null) return "null";
  if (typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
}

export function canonicalTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Date(Math.floor(d.getTime() / 1000) * 1000).toISOString().replace(".000Z", "Z");
}

export function canonicalEvent(e: {
  seq: number;
  type: string;
  entityId: string;
  actor: string;
  atIso: string;
  payload: Record<string, unknown>;
}): string {
  return canonicalJson({
    seq: e.seq,
    type: e.type,
    entityId: e.entityId,
    actor: e.actor,
    atIso: canonicalTime(e.atIso),
    payload: e.payload,
  });
}
