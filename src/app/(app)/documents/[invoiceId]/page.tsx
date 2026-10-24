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

  if (error)
    return <main className="p-4 text-sm text-[#B42318]">{error}</main>;
  if (!data)
    return <main className="p-4 text-sm text-[#5A6170]">Loading…</main>;

  const artefactCount =
    data.events.length +
    data.payments.length +
    data.messages.length +
    data.attachments.length;

  return (
    <main className="space-y-4 p-4 pb-24">
      <header>
        <div className="text-xs text-[#5A6170]">
          {data.customer.name} · {data.invoice.daysOverdue} days overdue
        </div>
        <h1 className="font-mono text-lg font-semibold">
          {data.invoice.number}
        </h1>
        <p className="text-xs text-[#5A6170]">
          {artefactCount} artefacts ·{" "}
          {formatINR(data.invoice.outstandingPaise)} outstanding
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={`/print/evidence/${data.invoice.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-[#0F5C4E] px-3 py-3 text-center text-xs font-medium text-white hover:bg-[#0F5C4E]/90"
        >
          📄 Download evidence pack
        </a>
        {data.demandLetterAvailable ? (
          <a
            href={`/print/letter/${data.invoice.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-3 text-center text-xs font-medium hover:bg-[#F7F8FA]"
          >
            ✉️ Open demand letter
          </a>
        ) : (
          <div
            className="rounded-lg border border-dashed border-[#E4E7EC] bg-white px-3 py-3 text-center text-xs text-[#5A6170]"
            title={`Invoice must be ≥30 days overdue (currently ${data.invoice.daysOverdue})`}
          >
            ✉️ Demand letter (needs 30d overdue)
          </div>
        )}
      </div>

      <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
        <h2 className="text-sm font-semibold">
          Timeline ({data.events.length} events)
        </h2>
        <ol className="mt-3 space-y-2 text-xs">
          {data.events.map((e) => (
            <li key={e.chainSeq} className="flex gap-2">
              <span className="min-w-[40px] text-[10px] text-[#5A6170]">
                #{e.chainSeq}
              </span>
              <div>
                <div className="font-medium">{titleCase(e.type)}</div>
                <div className="text-[10px] text-[#5A6170]">
                  {e.actor} · {e.atIso.slice(0, 10)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {data.attachments.length > 0 && (
        <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
          <h2 className="text-sm font-semibold">
            Attachments ({data.attachments.length})
          </h2>
          <ul className="mt-2 space-y-1 text-xs">
            {data.attachments.map((a) => (
              <li key={a.id} className="text-[#5A6170]">
                {a.mime}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        href={`/invoices/${data.invoice.id}`}
        className="block rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-center text-xs font-medium hover:bg-[#F7F8FA]"
      >
        Open invoice detail →
      </Link>
    </main>
  );
}
