import { readFileSync } from "node:fs";
import { join } from "node:path";
import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

const KEY_FILENAME = "zen-baaki-firebase-adminsdk-fbsvc-3d417df3af.json";

/**
 * Normalize a PEM private key so Node's crypto (via firebase-admin) can
 * parse it.
 *
 * This is THE fix for "error:1E08010C:DECODER routines::unsupported" on
 * Render/Vercel/Railway. Those platforms store multiline secret-file
 * content with literal "\n" sequences instead of real newlines. Node's
 * PEM parser requires real newlines inside the BEGIN/END markers.
 *
 * Handles, in order:
 *   - stray wrapping quotes
 *   - CRLF line endings (Windows-authored JSON)
 *   - double-escaped "\\n" -> "\n" (JSON-in-JSON layering)
 *   - literal "\n" -> real newline (the primary cause)
 *   - marker-spacing corruption ("-----BEGINPRIVATEKEY-----")
 *   - missing trailing newline after the END marker
 */
function normalizePem(raw: string): string {
  let k = raw ?? "";

  // 1. Strip wrapping quotes
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1);
  }

  // 2. Normalize CRLF -> LF
  k = k.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 3. Convert escaped newline sequences to real newlines.
  //    Order matters: double-backslash first, then single.
  k = k.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n");

  // 4. Repair marker-spacing bugs
  k = k.replace(/-----BEGINPRIVATEKEY-----/g, "-----BEGIN PRIVATE KEY-----");
  k = k.replace(/-----ENDPRIVATEKEY-----/g, "-----END PRIVATE KEY-----");
  k = k.replace(
    /-----BEGIN PRIVATE KEY-----(?!\n)/g,
    "-----BEGIN PRIVATE KEY-----\n",
  );
  k = k.replace(
    /([^\n])-----END PRIVATE KEY-----/g,
    "$1\n-----END PRIVATE KEY-----",
  );

  // 5. Trailing newline required by some crypto backends
  if (!k.endsWith("\n")) k += "\n";

  return k;
}

function normalizeServiceAccount(sa: ServiceAccount): ServiceAccount {
  return { ...sa, private_key: normalizePem(sa.private_key) };
}

/**
 * Parse a service-account JSON from a string.
 *
 * Two corruption modes are handled:
 *   a) The whole value is base64-encoded JSON (safest transport).
 *   b) The JSON itself is intact but the private_key contains literal
 *      "\n" escapes — normalizePem() handles that.
 *   c) The JSON has been corrupted by a secret manager that converted
 *      "\\n" escapes inside strings into bare newlines, which makes
 *      JSON.parse throw. The repair path re-escapes bare newlines only
 *      when they appear inside a JSON string literal.
 */
function parseServiceAccountFromString(
  raw: string,
  source: string,
): ServiceAccount {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(`${source} is empty.`);

  // Base64 path: raw JSON always contains "{", base64 never does.
  if (!trimmed.includes("{")) {
    try {
      const decoded = Buffer.from(
        trimmed.replace(/\s/g, ""),
        "base64",
      ).toString("utf8");
      if (decoded.trim().startsWith("{")) {
        return normalizeServiceAccount(JSON.parse(decoded) as ServiceAccount);
      }
    } catch {
      /* fall through */
    }
  }

  // Raw JSON path
  try {
    return normalizeServiceAccount(JSON.parse(trimmed) as ServiceAccount);
  } catch {
    /* fall through to repair */
  }

  // Repair path: walk the string character by character and re-escape
  // bare newlines that appear inside JSON string values. This is the
  // fix for secret managers that turn "\\n" into real newlines.
  try {
    let out = "";
    let inString = false;
    let escaped = false;
    for (const ch of trimmed) {
      if (escaped) {
        out += ch;
        escaped = false;
      } else if (ch === "\\" && inString) {
        out += ch;
        escaped = true;
      } else if (ch === '"') {
        out += ch;
        inString = !inString;
      } else if (ch === "\n" && inString) {
        out += "\\n";
      } else if (ch === "\r") {
        /* drop */
      } else {
        out += ch;
      }
    }
    return normalizeServiceAccount(JSON.parse(out) as ServiceAccount);
  } catch (e) {
    throw new Error(
      `${source} is not valid JSON or base64-JSON. ` +
        `For env vars, base64 is the reliable format. ` +
        `Cause: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Log the source and health of the loaded key. Compact on success,
 * detailed on failure.
 */
function diagnoseKey(sa: ServiceAccount, source: string): void {
  const k = sa.private_key ?? "";
  const trimmed = k.trim();
  const looksValid =
    trimmed.startsWith("-----BEGIN") &&
    trimmed.endsWith("-----") &&
    k.includes("\n") &&
    k.length > 1000;

  console.log(
    `[firebase-admin] loaded service account from ${source} ` +
      `(project=${sa.project_id})`,
  );

  if (looksValid) return;

  console.warn("[firebase-admin] ⚠️  private_key looks malformed:", {
    source,
    length: k.length,
    startsCorrectly: trimmed.startsWith("-----BEGIN"),
    endsCorrectly: trimmed.endsWith("-----"),
    hasRealNewline: k.includes("\n"),
    hasLiteralBackslashN: k.includes("\\n"),
    lineCount: k.split("\n").length,
    firstChars: JSON.stringify(k.slice(0, 50)),
    lastChars: JSON.stringify(k.slice(-50)),
  });
}

/**
 * Resolution order (first hit wins):
 *   1. FIREBASE_SERVICE_ACCOUNT_KEY env var (raw JSON or base64)
 *   2. /etc/secrets/<filename>       — Render secret file (Docker)
 *   3. /etc/secrets/<filename>.b64   — base64 variant
 *   4. <cwd>/<filename>              — Render secret file (native Node)
 *   5. <cwd>/<filename>.b64          — local dev base64
 */
function loadServiceAccount(): ServiceAccount {
  // 1. Env var
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (fromEnv && fromEnv.trim().length > 0) {
    const sa = parseServiceAccountFromString(
      fromEnv,
      "env FIREBASE_SERVICE_ACCOUNT_KEY",
    );
    diagnoseKey(sa, "env FIREBASE_SERVICE_ACCOUNT_KEY");
    return sa;
  }

  // 2–5. Files
  const candidates = [
    join("/etc/secrets", KEY_FILENAME),
    join("/etc/secrets", `${KEY_FILENAME}.b64`),
    join(process.cwd(), KEY_FILENAME),
    join(process.cwd(), `${KEY_FILENAME}.b64`),
  ];

  const errors: string[] = [];
  for (const path of candidates) {
    try {
      const raw = readFileSync(path, "utf8");
      const sa = parseServiceAccountFromString(raw, `file ${path}`);
      diagnoseKey(sa, `file ${path}`);
      return sa;
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === "ENOENT") {
        errors.push(`${path}: not found`);
      } else {
        errors.push(`${path}: ${(e as Error).message}`);
      }
    }
  }

  throw new Error(
    "Could not load Firebase service account. Set " +
      "FIREBASE_SERVICE_ACCOUNT_KEY (base64 recommended), or upload " +
      `${KEY_FILENAME} to Render's Secret Files. ` +
      `Tried:\n  - ${errors.join("\n  - ")}`,
  );
}

function getFirebaseAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;

  const sa = loadServiceAccount();

  try {
    return initializeApp({
      credential: cert({
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey: sa.private_key,
      }),
    });
  } catch (e) {
    // This is the layer where "Failed to parse private key" surfaces.
    // Dump everything about the key so the next debug cycle is a
    // copy-paste, not another guess.
    const k = sa.private_key ?? "";
    console.error("[firebase-admin] cert() initialization failed:", {
      error: e instanceof Error ? e.message : String(e),
      keyLength: k.length,
      lineCount: k.split("\n").length,
      firstLine: k.split("\n")[0],
      lastLine: k.split("\n").slice(-1)[0],
      hasRealNewline: k.includes("\n"),
      hasLiteralBackslashN: k.includes("\\n"),
      firstChars: JSON.stringify(k.slice(0, 80)),
      lastChars: JSON.stringify(k.slice(-80)),
    });
    throw e;
  }
}

let _auth: Auth | null = null;

export function getFirebaseAdminAuth(): Auth {
  if (!_auth) _auth = getAuth(getFirebaseAdminApp());
  return _auth;
}
