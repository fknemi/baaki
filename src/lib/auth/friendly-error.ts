/**
 * Merged auth-error mapper.
 *
 * Codes are grouped by flow so a reviewer can see at a glance which
 * Firebase operation can throw which string. Every auth page imports
 * this single function — no per-page copies.
 *
 * Note on `auth/user-not-found`: Firebase returns this on signIn but not
 * on signUp (signUp returns `auth/email-already-in-use` instead). The
 * message is deliberately "Email or password is incorrect" — returning
 * "No account found" would let an attacker enumerate registered emails.
 * This is the OWASP-recommended wording for auth errors.
 */
export function friendlyError(code: string): string {
  switch (code) {
    // ─── Email & password ────────────────────────────────────────
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email or password is incorrect.";
    case "auth/email-already-in-use":
      return "That email is already registered. Sign in instead.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact support.";
    case "auth/missing-password":
      return "Enter your password to continue.";

    // ─── Action links (email sign-in, reset, verify) ─────────────
    case "auth/expired-action-code":
      return "This link has expired. Request a new one.";
    case "auth/invalid-action-code":
      return "This link is invalid or already used. Request a new one.";

    // ─── Phone OTP ───────────────────────────────────────────────
    case "auth/invalid-phone-number":
      return "That phone number doesn't look valid. Include the country code (e.g. +91).";
    case "auth/missing-phone-number":
      return "Enter a phone number with the country code (e.g. +91).";
    case "auth/invalid-verification-code":
      return "Invalid code. Please check and try again.";
    case "auth/code-expired":
      return "That code expired. Request a new one.";
    case "auth/captcha-check-failed":
      return "Captcha check failed. Refresh and try again.";
    case "auth/quota-exceeded":
      return "Daily SMS limit reached. Try again tomorrow.";

    // ─── Shared ──────────────────────────────────────────────────
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    case "auth/operation-not-allowed":
      return "This sign-in method isn't enabled. Contact the administrator.";
    case "auth/requires-recent-login":
      return "Please sign out and sign back in, then try again.";
    case "auth/internal-error":
      return "Something went wrong on our end. Try again in a moment.";

    // ─── Fallback ────────────────────────────────────────────────
    default:
      return "Something went wrong. Try again.";
  }
}
