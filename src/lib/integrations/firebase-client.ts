import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp(): FirebaseApp {
  return getApps().length === 0 ? initializeApp(config) : getApp();
}

let _auth: Auth | null = null;
let _googleProvider: GoogleAuthProvider | null = null;

/**
 * Client-only. Never call at module scope — getAuth() eagerly validates
 * the API key and throws auth/invalid-api-key during SSR/prerender.
 * Call inside useEffect or an event handler.
 */
export function getFirebaseAuth(): Auth {
  if (typeof window === "undefined") {
    throw new Error("getFirebaseAuth() is client-only.");
  }
  if (!_auth) _auth = getAuth(getFirebaseApp());
  return _auth;
}

export function getGoogleProvider(): GoogleAuthProvider {
  if (!_googleProvider) _googleProvider = new GoogleAuthProvider();
  return _googleProvider;
}
