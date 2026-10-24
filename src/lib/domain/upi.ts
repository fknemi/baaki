/**
 * UPI VPA helpers.
 *
 * RBI/NPCI rule: UPI *intent* (deep-link) payments only work for
 * registered merchant VPAs. Personal VPAs — what most small businesses
 * have — open the UPI app but the payment is rejected inside the app
 * with "declined for security reasons". QR scans work for both types.
 *
 * There is no reliable syntactic way to tell merchant vs. personal
 * from the VPA string alone — that's a server-side attribute at the
 * PSP. This module uses an env-driven allowlist of known-merchant
 * handles. Default is empty (all VPAs treated as personal → "Copy UPI
 * ID" primary). Add a handle after the business signs up for a
 * merchant account and gets a merchant-enabled VPA.
 */

function envMerchantHandles(): string[] {
  const raw = process.env.NEXT_PUBLIC_MERCHANT_UPI_HANDLES ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.startsWith("@"));
}

/** Extract the handle portion of a VPA, e.g. "@okhdfcbank". */
function vpaHandle(upiId: string): string | null {
  const at = upiId.lastIndexOf("@");
  if (at < 0 || at === upiId.length - 1) return null;
  return upiId.slice(at).toLowerCase();
}

/**
 * Returns true if the VPA's handle is in the merchant allowlist.
 * Personal VPAs → false.
 */
export function isMerchantVpa(
  upiId: string | null | undefined,
): boolean {
  if (!upiId) return false;
  const handle = vpaHandle(upiId);
  if (!handle) return false;
  return envMerchantHandles().includes(handle);
}

/**
 * Build a UPI deep link per NPCI UPI Linking Spec v1.5.1.
 * Same URI is used for both the QR and the deep-link button — the
 * entry point differs, not the payload.
 */
export function buildUpiUri(
  upiId: string,
  payeeName: string,
  amountPaise: number,
  invoiceNumber: string,
): string {
  // tr: sanitize — some UPI apps mishandle slashes in the bank-statement
  // reference field, so strip everything except alphanumerics and cap at
  // 35 chars.
  const trSafe = invoiceNumber.replace(/[^A-Za-z0-9]/g, "").slice(0, 35);

  const params = [
    `pa=${encodeURIComponent(upiId)}`,
    `pn=${encodeURIComponent(payeeName)}`,
    `am=${(amountPaise / 100).toFixed(2)}`,
    `cu=INR`,
    `tn=${encodeURIComponent(`Invoice ${invoiceNumber}`)}`,
    `tr=${trSafe}`,
  ];
  return `upi://pay?${params.join("&")}`;
}
