"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { formatINR } from "@/lib/domain/money";
import { buildUpiUri, isMerchantVpa } from "@/lib/domain/upi";

type BankDetails = {
  accountName: string;
  accountNumberMasked: string;
  ifsc: string;
  bankName: string;
};

type InvoiceData = {
  invoice: {
    number: string;
    dueDate: string;
    invoiceDate: string;
    status: string;
    outstandingPaise: number;
    totalPaise: number;
    items: Array<{
      description: string;
      qty: number;
      unit: string;
      ratePaise: number;
    }>;
  };
  business: {
    name: string;
    upiId: string | null;
    phone: string | null;
    bank: BankDetails | null;
    paymentMethods: string[];
  };
};

// ─── outline icons (stroke, no fill) ─────────────────────────────────────────

function IconCopy({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconCheck({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconDownload({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconClose({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * Renders a standalone invoice summary as a PNG and triggers a download.
 * The PNG itself stays light — it's a customer-facing document, not
 * app chrome, so it matches printed invoices rather than the dark theme.
 */
async function downloadInvoiceImage(
  data: InvoiceData,
  qrUrl: string | null,
): Promise<void> {
  const { invoice, business } = data;
  const SCALE = 2;
  const W = 800;
  const H = 2800;
  const PAD = 48;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  let y = PAD;
  const contentW = W - PAD * 2;
  const fontStack =
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";
  const monoStack = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

  ctx.fillStyle = "#1A1D23";
  ctx.font = `600 32px ${fontStack}`;
  ctx.textBaseline = "top";
  ctx.fillText(business.name, PAD, y);
  y += 42;

  ctx.fillStyle = "#5A6170";
  ctx.font = `500 11px ${fontStack}`;
  ctx.fillText("INVOICE", PAD, y);
  y += 18;

  ctx.fillStyle = "#1A1D23";
  ctx.font = `600 20px ${monoStack}`;
  ctx.fillText(invoice.number, PAD, y);
  y += 32;

  ctx.strokeStyle = "#E4E7EC";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 24;

  ctx.fillStyle = "#5A6170";
  ctx.font = `500 11px ${fontStack}`;
  ctx.fillText("AMOUNT DUE", PAD, y);
  y += 18;

  ctx.fillStyle = "#1A1D23";
  ctx.font = `700 40px ${fontStack}`;
  ctx.fillText(formatINR(invoice.outstandingPaise), PAD, y);
  y += 52;

  ctx.fillStyle = "#5A6170";
  ctx.font = `400 12px ${fontStack}`;
  ctx.fillText(`Due ${invoice.dueDate}`, PAD, y);
  y += 24;

  ctx.strokeStyle = "#E4E7EC";
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 24;

  const showUpi =
    business.paymentMethods.includes("upi") &&
    !!business.upiId &&
    !!qrUrl;
  if (showUpi) {
    ctx.fillStyle = "#1A1D23";
    ctx.font = `600 14px ${fontStack}`;
    ctx.fillText("Pay by UPI", PAD, y);
    y += 24;

    const qrSize = 220;
    const qrX = (W - qrSize) / 2;
    await new Promise<void>((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        ctx.drawImage(img, qrX, y, qrSize, qrSize);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = qrUrl!;
    });
    y += qrSize + 12;

    if (business.upiId) {
      ctx.fillStyle = "#5A6170";
      ctx.font = `400 12px ${monoStack}`;
      ctx.textAlign = "center";
      ctx.fillText(business.upiId, W / 2, y);
      ctx.textAlign = "left";
      y += 20;
    }
    y += 12;

    ctx.strokeStyle = "#E4E7EC";
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    y += 20;
  }

  if (business.paymentMethods.includes("bank") && business.bank) {
    ctx.fillStyle = "#1A1D23";
    ctx.font = `600 14px ${fontStack}`;
    ctx.fillText("Bank transfer", PAD, y);
    y += 24;

    const rows: Array<[string, string]> = [
      ["Bank", business.bank.bankName],
      ["Account holder", business.bank.accountName],
      ["Account number", business.bank.accountNumberMasked],
      ["IFSC", business.bank.ifsc],
      ["Amount", formatINR(invoice.outstandingPaise)],
      ["Reference", invoice.number],
    ];

    ctx.font = `400 12px ${fontStack}`;
    for (const [label, value] of rows) {
      ctx.fillStyle = "#5A6170";
      ctx.fillText(label, PAD, y);
      ctx.fillStyle = "#1A1D23";
      ctx.textAlign = "right";
      ctx.fillText(value, W - PAD, y);
      ctx.textAlign = "left";
      y += 22;
    }
    y += 8;

    ctx.strokeStyle = "#E4E7EC";
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    y += 20;
  }

  ctx.fillStyle = "#5A6170";
  ctx.font = `500 10px ${fontStack}`;
  ctx.fillText("DESCRIPTION", PAD, y);
  ctx.textAlign = "right";
  ctx.fillText("AMOUNT", W - PAD, y);
  ctx.textAlign = "left";
  y += 22;

  for (const it of invoice.items) {
    const desc = `${it.qty} ${it.unit} × ${it.description}`;
    const maxDescW = contentW - 130;
    let truncated = desc;
    while (
      ctx.measureText(truncated).width > maxDescW &&
      truncated.length > 4
    ) {
      truncated = truncated.slice(0, -4) + "…";
    }
    ctx.fillStyle = "#1A1D23";
    ctx.font = `400 13px ${fontStack}`;
    ctx.fillText(truncated, PAD, y);
    ctx.textAlign = "right";
    ctx.fillText(formatINR(it.qty * it.ratePaise), W - PAD, y);
    ctx.textAlign = "left";
    y += 24;

    ctx.strokeStyle = "#F0F2F5";
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    y += 6;
  }

  y += 8;

  ctx.fillStyle = "#1A1D23";
  ctx.font = `600 15px ${fontStack}`;
  ctx.fillText("Total invoice amount", PAD, y);
  ctx.textAlign = "right";
  ctx.fillText(formatINR(invoice.totalPaise), W - PAD, y);
  ctx.textAlign = "left";
  y += 44;

  ctx.fillStyle = "#5A6170";
  ctx.font = `400 10px ${fontStack}`;
  ctx.textAlign = "center";
  if (business.phone) {
    ctx.fillText(`Questions? Call ${business.phone}.`, W / 2, y);
    y += 16;
  }
  ctx.fillText(
    "Computer-generated invoice summary · Prototype with sample data",
    W / 2,
    y,
  );
  y += PAD;

  const finalH = Math.ceil(y);
  const out = document.createElement("canvas");
  out.width = W * SCALE;
  out.height = finalH * SCALE;
  const octx = out.getContext("2d");
  if (!octx) return;
  octx.drawImage(
    canvas,
    0,
    0,
    W * SCALE,
    finalH * SCALE,
    0,
    0,
    W * SCALE,
    finalH * SCALE,
  );

  const safeBusiness = business.name
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const safeNumber = invoice.number
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `${safeBusiness} - ${safeNumber}.png`.slice(0, 120);

  const blob = await new Promise<Blob | null>((resolve) =>
    out.toBlob(resolve, "image/png"),
  );
  const href = blob
    ? URL.createObjectURL(blob)
    : out.toDataURL("image/png");

  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (blob) {
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
}

// Shared surfaces — kept in one place so theme tweaks are one edit.
const SURFACE = "rounded-xl border border-white/10 p-4";
const PRIMARY =
  "flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0F5C4E] px-4 py-3 text-center text-xs font-medium text-white hover:bg-[#0F5C4E]/90";

export default function PayClient() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [data, setData] = useState<InvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"none" | "paid" | "dispute">("none");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);
  const [deepLinkNotice, setDeepLinkNotice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/pay/${token}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error.message);
        else setData(j.data);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  const isMerchant = useMemo(
    () => isMerchantVpa(data?.business.upiId),
    [data?.business.upiId],
  );

  const showUpi = useMemo(
    () =>
      !!data?.business.paymentMethods?.includes("upi") &&
      !!data?.business.upiId,
    [data],
  );

  const showBank = useMemo(
    () =>
      !!data?.business.paymentMethods?.includes("bank") &&
      !!data?.business.bank,
    [data],
  );

  const upiUri = useMemo(() => {
    if (!data?.business.upiId || submitted || !showUpi) return null;
    return buildUpiUri(
      data.business.upiId,
      data.business.name,
      data.invoice.outstandingPaise,
      data.invoice.number,
    );
  }, [data, submitted, showUpi]);

  useEffect(() => {
    if (!upiUri) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQrUrl(null);
      return;
    }
    QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 200,
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(null));
  }, [upiUri]);

  async function copyText(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }

  async function copyUpiId() {
    if (!data?.business.upiId) return;
    await copyText(data.business.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  }

  async function copyBankDetails() {
    if (!data?.business.bank) return;
    const b = data.business.bank;
    const text = [
      data.business.name,
      b.bankName,
      `Account holder: ${b.accountName}`,
      `Account number: ${b.accountNumberMasked}`,
      `IFSC: ${b.ifsc}`,
      `Amount: ${formatINR(data.invoice.outstandingPaise)}`,
      `Reference: ${data.invoice.number}`,
    ].join("\n");
    await copyText(text);
    setCopiedBank(true);
    setTimeout(() => setCopiedBank(false), 2000);
  }

  async function saveInvoice() {
    if (!data || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      await downloadInvoiceImage(data, qrUrl);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold text-white">
          Link not available
        </h1>
        <p className="mt-2 text-xs text-white">{error}</p>
        <p className="mt-6 text-[10px] italic text-white">
          This page is a prototype.
        </p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-md p-6 text-center text-xs text-white">
        Loading…
      </main>
    );
  }

  const { invoice, business } = data;
  const hasAnyMethod = showUpi || showBank;

  return (
    <main className="mx-auto max-w-md space-y-4 p-4 pb-24">
      <header className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0F5C4E] text-lg font-semibold text-white">
          {business.name.charAt(0)}
        </div>
        <h1 className="mt-2 text-base font-semibold text-white">
          {business.name}
        </h1>
      </header>

      <section className={SURFACE}>
        <div className="text-xs italic text-white">Invoice</div>
        <div className="mt-0.5 font-mono text-sm text-white">
          {invoice.number}
        </div>
        <div className="mt-3 text-xs italic text-white">Amount due</div>
        <div className="text-2xl font-semibold tabular-nums text-white">
          {formatINR(invoice.outstandingPaise)}
        </div>
        <div className="text-[10px] italic text-white">
          Due {invoice.dueDate}
        </div>

        <ul className="mt-3 space-y-1 border-t border-white/10 pt-3 text-[10px]">
          {invoice.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="text-white italic">
                {it.qty} {it.unit} × {it.description}
              </span>
              <span className="tabular-nums text-white">
                {formatINR(it.qty * it.ratePaise)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* UPI payment block */}
      {showUpi && upiUri && !submitted && (
        <section className={SURFACE}>
          <div className="text-xs font-semibold text-white">Pay by UPI</div>
          <p className="mt-1 text-[10px] italic text-white">
            Scan this QR with any UPI app to pay.
          </p>

          <div className="mt-3 rounded-lg border border-dashed border-white/10 p-4 text-center">
            {qrUrl ? (
              <button
                type="button"
                onDoubleClick={saveInvoice}
                onClick={() => {
                  /* intentional no-op — double-click saves */
                }}
                className="mx-auto block cursor-zoom-in select-none rounded border-0 bg-white p-1"
                aria-label="Double-click to save invoice as image"
                title="Double-click to save invoice as image"
                style={{ touchAction: "manipulation" }}
              >
                <Image
                  src={qrUrl}
                  alt={`UPI QR for ${invoice.number}`}
                  width={160}
                  height={160}
                  unoptimized
                  draggable={false}
                  className="block"
                />
              </button>
            ) : (
              <div className="mx-auto h-40 w-40 animate-pulse rounded bg-white/5" />
            )}
            <div className="mt-2 break-all font-mono text-[10px] text-white">
              {business.upiId}
            </div>
            <div className="mt-1 text-[10px] italic text-white">
              Amount pre-fills to {formatINR(invoice.outstandingPaise)}
            </div>
            <div className="mt-1 text-[10px] italic text-white">
              Reference auto-fills as{" "}
              <span className="font-mono">
                {invoice.number.replace(/[^A-Za-z0-9]/g, "")}
              </span>
            </div>
            {qrUrl && (
              <button
                type="button"
                onClick={saveInvoice}
                disabled={saving}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 text-[10px] text-white underline underline-offset-4 disabled:opacity-50"
                aria-label="Download invoice summary as image"
              >
                {saving ? (
                  "Saving…"
                ) : saved ? (
                  <>
                    <IconCheck className="h-3 w-3" />
                    Saved
                  </>
                ) : (
                  <>
                    <IconDownload className="h-3 w-3" />
                    Save invoice as image
                  </>
                )}
              </button>
            )}
          </div>

          {isMerchant ? (
            <>
              <a href={upiUri} className={`mt-3 ${PRIMARY}`}>
                Open UPI app
              </a>
              <button
                type="button"
                onClick={copyUpiId}
                className="mt-2 flex w-full items-center justify-center gap-1.5 text-center text-[10px] text-white underline underline-offset-4"
              >
                {copiedUpi ? (
                  <>
                    <IconCheck className="h-3 w-3" />
                    UPI ID copied
                  </>
                ) : (
                  "Or copy UPI ID"
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={copyUpiId}
                className={`mt-3 ${PRIMARY}`}
              >
                {copiedUpi ? (
                  <>
                    <IconCheck className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <IconCopy className="h-3 w-3" />
                    Copy UPI ID
                  </>
                )}
              </button>
              <a
                href={upiUri}
                onClick={() => setDeepLinkNotice(true)}
                className="mt-2 block rounded-lg border border-white/10 bg-[#171717]/20 px-4 py-3 text-center text-xs font-medium text-white hover:bg-white/5"
              >
                Open UPI app
              </a>
              {deepLinkNotice && (
                <div className="mt-2 rounded-lg border border-[#B54708]/40 bg-[#B54708]/10 p-2 text-[10px] text-white">
                  <p className="font-medium text-white">Heads up:</p>
                  <p className="mt-0.5 italic">
                    UPI apps reject deep-link payments to personal UPI IDs
                    (RBI/NPCI rule). If the app opens but the payment is
                    declined, scan the QR above or paste the UPI ID into
                    your app&apos;s &ldquo;pay to VPA&rdquo; field — both work.
                  </p>
                  <button
                    onClick={() => setDeepLinkNotice(false)}
                    className="mt-1 underline underline-offset-4"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Bank transfer block */}
      {showBank && business.bank && !submitted && (
        <section className={SURFACE}>
          <div className="text-xs font-semibold text-white">
            Bank transfer
          </div>
          <p className="mt-1 text-[10px] italic text-white">
            Use NEFT, RTGS, or IMPS from your bank app. Include the reference
            so the payment can be matched.
          </p>

          <dl className="mt-3 space-y-1.5 text-xs">
            <BankRow label="Bank" value={business.bank.bankName} />
            <BankRow label="Account holder" value={business.bank.accountName} />
            <BankRow
              label="Account number"
              value={business.bank.accountNumberMasked}
              mono
            />
            <BankRow label="IFSC" value={business.bank.ifsc} mono />
            <BankRow label="Amount" value={formatINR(invoice.outstandingPaise)} />
            <BankRow label="Reference" value={invoice.number} mono />
          </dl>

          <button
            type="button"
            onClick={copyBankDetails}
            className={`mt-3 ${PRIMARY}`}
          >
            {copiedBank ? (
              <>
                <IconCheck className="h-3 w-3" />
                Bank details copied
              </>
            ) : (
              <>
                <IconCopy className="h-3 w-3" />
                Copy bank details
              </>
            )}
          </button>

          {showUpi && qrUrl && (
            <button
              type="button"
              onClick={saveInvoice}
              disabled={saving}
              className="mt-2 flex w-full items-center justify-center gap-1.5 text-center text-[10px] text-white underline underline-offset-4 disabled:opacity-50"
            >
              {saving ? (
                "Saving…"
              ) : saved ? (
                <>
                  <IconCheck className="h-3 w-3" />
                  Saved
                </>
              ) : (
                <>
                  <IconDownload className="h-3 w-3" />
                  Save invoice as image
                </>
              )}
            </button>
          )}
        </section>
      )}

      {/* No payment methods configured */}
      {!hasAnyMethod && !submitted && (
        <section className={`${SURFACE} text-xs italic text-white`}>
          No payment methods are configured. Please contact{" "}
          {business.name} to arrange payment.
        </section>
      )}

      {!submitted && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode("paid")}
            className="rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-xs font-medium text-white hover:bg-white/5"
          >
            I&apos;ve already paid
          </button>
          <button
            onClick={() => setMode("dispute")}
            className="rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-xs font-medium text-white hover:bg-white/5"
          >
            Something&apos;s wrong
          </button>
        </div>
      )}

      {submitted && (
        <div className="flex items-center justify-center gap-1.5 rounded-xl bg-[#235C49] p-4 text-center text-xs text-white">
          <span>Sent</span>
          <IconCheck className="h-3 w-3" />
          <span>{business.name} will review and reply.</span>
        </div>
      )}

      <footer className="text-center text-[10px] text-white">
        Questions?{" "}
        {business.phone ? (
          <a
            href={`tel:${business.phone}`}
            className="underline underline-offset-4"
          >
            Call {business.phone}
          </a>
        ) : (
          <span className="italic">
            Contact the business that sent this invoice.
          </span>
        )}
        <div className="mt-1 italic">This page is a prototype.</div>
      </footer>

      {mode !== "none" && (
        <SubmitSheet
          mode={mode}
          token={token}
          submitting={submitting}
          onClose={() => setMode("none")}
          onSubmitted={() => {
            setSubmitted(true);
            setMode("none");
          }}
          onSubmitting={setSubmitting}
        />
      )}
    </main>
  );
}

function BankRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-white italic">{label}</dt>
      <dd className={`text-right text-white ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

/* SubmitSheet */
function SubmitSheet({
  mode,
  token,
  submitting,
  onClose,
  onSubmitted,
  onSubmitting,
}: {
  mode: "paid" | "dispute";
  token: string;
  submitting: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  onSubmitting: (v: boolean) => void;
}) {
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    onSubmitting(true);
    setError(null);
    try {
      const path = mode === "paid" ? "already-paid" : "dispute";
      const body = mode === "paid" ? { reference, paidOn } : { reason };
      const res = await fetch(`/api/pay/${token}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error?.message ?? "Failed");
        return;
      }
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      onSubmitting(false);
    }
  }

  const fieldSurface =
    "w-full rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#192221] p-4 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-white">
            {mode === "paid" ? "I've already paid" : "Something's wrong"}
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white"
            aria-label="Close"
          >
            <IconClose className="h-3.5 w-3.5" />
          </button>
        </div>

        {mode === "paid" ? (
          <div className="mt-3 space-y-2">
            <input
              type="text"
              placeholder="Reference number"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className={fieldSurface}
            />
            <input
              type="date"
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
              className={fieldSurface}
            />
          </div>
        ) : (
          <textarea
            rows={4}
            placeholder="What's wrong with this invoice?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`mt-3 ${fieldSurface}`}
          />
        )}

        {error && <p className="mt-2 text-xs text-white">{error}</p>}

        <button
          onClick={submit}
          disabled={
            submitting || (mode === "dispute" && reason.trim().length === 0)
          }
          className="mt-3 w-full rounded-lg bg-[#0F5C4E] px-3 py-2 text-xs font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
