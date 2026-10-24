import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET required");
  return s;
}

function b64urlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(input: string): string {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(
    input.replace(/-/g, "+").replace(/_/g, "/") + pad,
    "base64",
  ).toString("utf8");
}

export type PayTokenPayload = {
  invoiceId: string;
  businessId: string;
  nonce: string;
  exp: number;
};

export function signPayToken(
  invoiceId: string,
  businessId: string,
  ttlDays = 30,
): { token: string; payload: PayTokenPayload } {
  const payload: PayTokenPayload = {
    invoiceId,
    businessId,
    nonce: randomBytes(8).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + ttlDays * 86400,
  };
  const header = b64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = b64urlEncode(
    createHmac("sha256", getSecret()).update(`${header}.${body}`).digest(),
  );
  return { token: `${header}.${body}.${sig}`, payload };
}

/** Returns null on any failure (invalid sig, expired, malformed). */
export function verifyPayToken(token: string): PayTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts as [string, string, string];
  const expected = b64urlEncode(
    createHmac("sha256", getSecret()).update(`${header}.${body}`).digest(),
  );
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(b64urlDecode(body)) as PayTokenPayload;
    if (typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.invoiceId !== "string") return null;
    if (typeof payload.businessId !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

/** Unverified decode — used only to extract businessId for friendly 404s. */
export function decodePayTokenUnverified(
  token: string,
): { invoiceId?: string; businessId?: string } {
  const parts = token.split(".");
  if (parts.length !== 3) return {};
  try {
    return JSON.parse(b64urlDecode(parts[1]!));
  } catch {
    return {};
  }
}
