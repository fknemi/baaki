"use client";

import { useCallback, useEffect, useState } from "react";
import { UploadButton } from "@/components/upload-button";

type Attachment = {
  id: string;
  storageKey: string;
  mime: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
};

// ─── outline icon ────────────────────────────────────────────────────────────
// Capped at h-4 (16px) on lg/xl — going to h-5 inside a ~36px "Open" pill
// looked oversized (same bug that hit the InvoiceDetailPage icons).

const ICON_STD =
  "h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4";

function IconExternalLink({ className = ICON_STD }: { className?: string }) {
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
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// Matches InvoiceDetailPage's CARD exactly so this section sits flush with
// the other cards on the page at every breakpoint.
const CARD =
  "rounded-lg border border-white/10 p-3 sm:rounded-xl sm:p-4 md:rounded-xl md:p-5 lg:rounded-2xl lg:p-6 xl:rounded-2xl xl:p-6";

export function AttachmentsSection({ invoiceId }: { invoiceId: string }) {
  const [files, setFiles] = useState<Attachment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/attachments`);
      if (!res.ok) return;
      const j = await res.json();
      setFiles(j.data ?? []);
    } catch {
      /* ignore */
    }
  }, [invoiceId]);

  useEffect(() => {
    // reload is an async useCallback — setState fires after its internal
    // awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  async function handleUploaded(storageKey: string, sha256: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/uploads/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageKey, sha256 }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.error?.message ?? "Confirmation failed");
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function open(id: string) {
    const res = await fetch(`/api/uploads/signed/${id}`);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j?.error?.message ?? "Open failed");
      return;
    }
    window.open(j.data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className={CARD}>
      <h2 className="text-xs font-semibold text-white sm:text-sm md:text-base lg:text-base xl:text-lg">
        Attachments
      </h2>

      <div className="mt-2 sm:mt-2 md:mt-3 lg:mt-3 xl:mt-4">
        {/* NOTE: UploadButton is a child component — its trigger and any
            internal Input/InputGroup need the same h-11 sm:h-11 md:h-12
            lg:h-12 xl:h-14 + text-sm sm:text-sm md:text-base lg:text-base
            xl:text-lg scale to sit flush with the rest of the page. */}
        <UploadButton
          onUploaded={handleUploaded}
          label="Attach file"
          entityType="invoice"
          entityId={invoiceId}
        />
      </div>

      {busy && (
        <p className="mt-2 text-xs italic text-white sm:mt-2 sm:text-sm md:mt-2.5 md:text-sm lg:mt-3 lg:text-base xl:mt-3 xl:text-base">
          Verifying…
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs text-[#FF9B8F] sm:mt-2 sm:text-sm md:mt-2.5 md:text-sm lg:mt-3 lg:text-base xl:mt-3 xl:text-base">
          {error}
        </p>
      )}

      {files === null && (
        <p className="mt-2 text-xs italic text-white sm:mt-2 sm:text-sm md:mt-2.5 md:text-sm lg:mt-3 lg:text-base xl:mt-3 xl:text-base">
          Loading…
        </p>
      )}

      {files !== null && files.length === 0 && (
        <p className="mt-2 text-xs italic text-white sm:mt-2 sm:text-sm md:mt-2.5 md:text-sm lg:mt-3 lg:text-base xl:mt-3 xl:text-base">
          No attachments yet.
        </p>
      )}

      {files !== null && files.length > 0 && (
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1 sm:mt-3 sm:max-h-72 sm:space-y-2 sm:pr-1 md:mt-4 md:max-h-80 md:space-y-2.5 md:pr-1.5 lg:mt-4 lg:max-h-96 lg:space-y-3 lg:pr-2 xl:mt-5 xl:max-h-96 xl:space-y-3 xl:pr-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-2 border border-white/10 p-2 sm:gap-2 sm:p-2.5 md:gap-2.5 md:p-3 lg:gap-3 lg:p-3 xl:gap-3 xl:p-3.5"
            >
              <div className="min-w-0">
                <div className="truncate font-mono text-[10px] text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                  {f.storageKey.split("/").pop()}
                </div>
                <div className="text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                  {f.mime} · {formatBytes(f.sizeBytes)} ·{" "}
                  {new Date(f.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => open(f.id)}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-[#171717]/20 px-2 py-1 text-[10px] font-medium text-white hover:bg-white/5 sm:h-7 sm:gap-1 sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-xs md:h-8 md:gap-1.5 md:rounded-lg md:px-3 md:py-1.5 md:text-xs lg:h-9 lg:gap-1.5 lg:rounded-lg lg:px-3 lg:py-2 lg:text-sm xl:h-9 xl:gap-2 xl:rounded-lg xl:px-3.5 xl:py-2 xl:text-sm"
              >
                <IconExternalLink />
                Open
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
