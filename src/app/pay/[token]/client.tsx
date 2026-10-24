"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatINR } from "@/lib/domain/money";
import Image from "next/image";
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
  };
};

export default function PayClient() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [data, setData] = useState<InvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"none" | "paid" | "dispute">("none");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/pay/${token}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error.message);
        else setData(j.data);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!data?.business.upiId || submitted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQrUrl(null);
      return;
    }
    const uri =
      `upi://pay?pa=${encodeURIComponent(data.business.upiId)}` +
      `&pn=${encodeURIComponent(data.business.name)}` +
      `&am=${(data.invoice.outstandingPaise / 100).toFixed(2)}` +
      `&cu=INR` +
      `&tn=${encodeURIComponent(data.invoice.number)}`;
    QRCode.toDataURL(uri, { errorCorrectionLevel: "M", margin: 1, width: 200 })
      .then(setQrUrl)
      .catch(() => setQrUrl(null));
  }, [data, submitted]);

  if (error) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold">Link not available</h1>
        <p className="mt-2 text-xs text-[#5A6170]">{error}</p>
        <p className="mt-6 text-[10px] text-[#5A6170]">This page is a prototype.</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-md p-6 text-center text-xs text-[#5A6170]">Loading…</main>
    );
  }

  const { invoice, business } = data;
  const upiUri = business.upiId
    ? `upi://pay?pa=${encodeURIComponent(business.upiId)}&pn=${encodeURIComponent(business.name)}&am=${(invoice.outstandingPaise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoice.number)}`
    : null;

  return (
    <main className="mx-auto max-w-md space-y-4 p-4 pb-24">
      <header className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0F5C4E] text-lg font-semibold text-white">
          {business.name.charAt(0)}
        </div>
        <h1 className="mt-2 text-base font-semibold">{business.name}</h1>
      </header>

      <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
        <div className="text-xs text-[#5A6170]">Invoice</div>
        <div className="mt-0.5 font-mono text-sm">{invoice.number}</div>
        <div className="mt-3 text-xs text-[#5A6170]">Amount due</div>
        <div className="text-2xl font-semibold tabular-nums">
          {formatINR(invoice.outstandingPaise)}
        </div>
        <div className="text-[10px] text-[#5A6170]">Due {invoice.dueDate}</div>

        <ul className="mt-3 space-y-1 border-t border-[#E4E7EC] pt-3 text-[10px]">
          {invoice.items.map((it, i) => (
            <li key={i} className="flex justify-between">
              <span className="text-[#5A6170]">
                {it.qty} {it.unit} × {it.description}
              </span>
              <span className="tabular-nums">{formatINR(it.qty * it.ratePaise)}</span>
            </li>
          ))}
        </ul>
      </section>

      {upiUri && !submitted && (
        <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
          <div className="text-xs font-semibold">Pay by UPI</div>
          <p className="mt-1 text-[10px] text-[#5A6170]">
            Scan with any UPI app, or tap the button below.
          </p>

          <div className="mt-3 rounded-lg border border-dashed border-[#E4E7EC] p-4 text-center">
            {qrUrl ? (
              <Image
                src={qrUrl}
                alt={`UPI QR for ${invoice.number}`}
                width={160}
                height={160}
                className="mx-auto"
                unoptimized
              />
            ) : (
              <div className="mx-auto h-40 w-40 animate-pulse rounded bg-[#F7F8FA]" />
            )}
            <div className="mt-2 font-mono text-[10px] break-all text-[#5A6170]">
              {business.upiId}
            </div>
            <div className="mt-1 text-[10px] text-[#5A6170]">
              Scan amount pre-fills to {formatINR(invoice.outstandingPaise)}
            </div>
          </div>
          <a
            href={upiUri}
            className="mt-3 block rounded-lg bg-[#0F5C4E] px-4 py-3 text-center text-xs font-medium text-white hover:bg-[#0F5C4E]/90"
          >
            Open UPI app
          </a>
        </section>
      )}

      {!submitted && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode("paid")}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-medium hover:bg-[#F7F8FA]"
          >
            I&apos;ve already paid
          </button>
          <button
            onClick={() => setMode("dispute")}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-medium hover:bg-[#F7F8FA]"
          >
            Something&apos;s wrong
          </button>
        </div>
      )}

      {submitted && (
        <div className="rounded-xl bg-[#ECFDF5] p-4 text-center text-xs text-[#067647] ring-1 ring-[#A6F4C5]">
          Sent ✓ {business.name} will review and reply.
        </div>
      )}

      <footer className="text-center text-[10px] text-[#5A6170]">
        Questions?{" "}
        {business.phone ? (
          <a href={`tel:${business.phone}`} className="underline">
            Call {business.phone}
          </a>
        ) : (
          <span>Contact the business that sent this invoice.</span>
        )}
        <div className="mt-1">This page is a prototype.</div>
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold">
            {mode === "paid" ? "I've already paid" : "Something's wrong"}
          </h2>
          <button onClick={onClose} className="text-[#5A6170]" aria-label="Close">
            ✕
          </button>
        </div>

        {mode === "paid" ? (
          <div className="mt-3 space-y-2">
            <input
              type="text"
              placeholder="Reference number"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
              className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <textarea
            rows={4}
            placeholder="What's wrong with this invoice?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-3 w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm"
          />
        )}

        {error && <p className="mt-2 text-xs text-[#B42318]">{error}</p>}

        <button
          onClick={submit}
          disabled={submitting || (mode === "dispute" && reason.trim().length === 0)}
          className="mt-3 w-full rounded-lg bg-[#0F5C4E] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
