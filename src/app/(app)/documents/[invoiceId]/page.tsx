"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatINR } from "@/lib/domain/money";

type Evidence = {
  generatedAt: string;
  invoice: {
    id: string;
    number: string;
    status: string;
    dueDate: string;
    outstandingPaise: number;
    daysOverdue: number;
  };
  customer: { name: string };
  events: Array<{
    chainSeq: number;
    type: string;
    actor: string;
    atIso: string;
  }>;
  payments: Array<{
    id: string;
    amountPaise: number;
    paidOn: string;
    reference: string | null;
  }>;
  messages: Array<{
    id: string;
    type: string;
    status: string;
    message: string | null;
    createdAt: string;
  }>;
  attachments: Array<{ id: string; mime: string }>;
  demandLetterAvailable: boolean;
};

// ─── outline icons ───────────────────────────────────────────────────────────

function IconFileText({ className = "h-3.5 w-3.5" }: { className?: string }) {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function IconMail({ className = "h-3.5 w-3.5" }: { className?: string }) {
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
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function IconArrowRight({ className = "h-3.5 w-3.5" }: { className?: string }) {
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
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

const CARD = "rounded-xl border border-white/10 p-4";
const SCROLL = "overflow-y-auto pr-1";

function titleCase(s: string): string {
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DocumentsDetailPage() {
  const params = useParams<{ invoiceId: string }>();
  const invoiceId = params?.invoiceId;
  const [data, setData] = useState<Evidence | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) return;
    fetch(`/api/documents/${invoiceId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error.message);
        else setData(j.data);
      })
      .catch((e) => setError(e.message));
  }, [invoiceId]);

  if (error) return <main className="p-4 text-sm text-white">{error}</main>;
  if (!data) return <main className="p-4 text-sm text-white">Loading…</main>;

  const artefactCount =
    data.events.length + data.payments.length + data.messages.length + data.attachments.length;

  return (
    <main className="space-y-4 p-4 pb-24 pt-14">
      <header>
        <div className="text-xs text-white italic">
          {data.customer.name} · {data.invoice.daysOverdue} days overdue
        </div>
        <h1 className="font-mono text-lg font-semibold text-white">
          {data.invoice.number}
        </h1>
        <p className="text-xs text-white italic">
          {artefactCount} artefacts · {formatINR(data.invoice.outstandingPaise)}{" "}
          outstanding
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={`/print/evidence/${data.invoice.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-[#0F5C4E] px-3 py-3 text-center text-xs font-medium text-white hover:bg-[#0F5C4E]/90"
        >
          <IconFileText />
          Download evidence pack
        </a>
        {data.demandLetterAvailable ? (
          <a
            href={`/print/letter/${data.invoice.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-3 text-center text-xs font-medium text-white hover:bg-white/5"
          >
            <IconMail />
            Open demand letter
          </a>
        ) : (
          <div
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-xs text-white italic"
            title={`Invoice must be ≥30 days overdue (currently ${data.invoice.daysOverdue})`}
          >
            <IconMail />
            Demand letter (needs 30d overdue)
          </div>
        )}
      </div>

      <section className={CARD}>
        <h2 className="text-sm font-semibold text-white">
          Timeline ({data.events.length} events)
        </h2>
        <ol className={`mt-3 max-h-64 space-y-2 text-xs ${SCROLL}`}>
          {data.events.map((e) => (
            <li key={e.chainSeq} className="flex gap-2">
              <span className="min-w-[40px] text-[10px] text-white italic">
                #{e.chainSeq}
              </span>
              <div>
                <div className="font-medium text-white">{titleCase(e.type)}</div>
                <div className="text-[10px] text-white italic">
                  {e.actor} · {e.atIso.slice(0, 10)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {data.attachments.length > 0 && (
        <section className={CARD}>
          <h2 className="text-sm font-semibold text-white">
            Attachments ({data.attachments.length})
          </h2>
          <ul className={`mt-2 max-h-48 space-y-1 text-xs ${SCROLL}`}>
            {data.attachments.map((a) => (
              <li key={a.id} className="text-white italic">
                {a.mime}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        href={`/invoices/${data.invoice.id}`}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-center text-xs font-medium text-white hover:bg-white/5"
      >
        Open invoice detail
        <IconArrowRight />
      </Link>
    </main>
  );
}
