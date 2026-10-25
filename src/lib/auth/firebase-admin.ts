import { readFileSync } from "node:fs";
import { join } from "node:path";
import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

const KEY_FILENAME = "zen-baaki-firebase-adminsdk-fbsvc-50e22c08e6.json";

function loadServiceAccount(): ServiceAccount {
  // Production (Vercel): full JSON in env var
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv) as ServiceAccount;
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.");
    }
  }

  // Local dev: read the downloaded key file from project root
  try {
    const raw = readFileSync(join(process.cwd(), KEY_FILENAME), "utf8");
    return JSON.parse(raw) as ServiceAccount;
  } catch (e) {
    throw new Error(
      `Could not read ${KEY_FILENAME} from ${process.cwd()}. ` +
        `Place the file at the project root or set FIREBASE_SERVICE_ACCOUNT_KEY. ` +
        `Cause: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

function getFirebaseAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;

  const sa = loadServiceAccount();

  return initializeApp({
    credential: cert({
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      privateKey: sa.private_key,
    }),
  });
}

let _auth: Auth | null = null;

export function getFirebaseAdminAuth(): Auth {
  if (!_auth) _auth = getAuth(getFirebaseAdminApp());
  return _auth;
}
