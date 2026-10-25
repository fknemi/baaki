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

function IconExternalLink({ className = "h-3 w-3" }: { className?: string }) {
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

const CARD = "rounded-xl border border-white/10 p-4";

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
      <h2 className="text-xs font-semibold text-white">Attachments</h2>

      <div className="mt-2">
        <UploadButton
          onUploaded={handleUploaded}
          label="Attach file"
          entityType="invoice"
          entityId={invoiceId}
        />
      </div>

      {busy && <p className="mt-2 text-xs text-white italic">Verifying…</p>}
      {error && <p className="mt-2 text-xs text-[#FF9B8F]">{error}</p>}

      {files === null && (
        <p className="mt-2 text-xs text-white italic">Loading…</p>
      )}

      {files !== null && files.length === 0 && (
        <p className="mt-2 text-xs text-white italic">No attachments yet.</p>
      )}

      {files !== null && files.length > 0 && (
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-2 border border-white/10 p-2 text-xs"
            >
              <div className="min-w-0">
                <div className="truncate font-mono text-[10px] text-white">
                  {f.storageKey.split("/").pop()}
                </div>
                <div className="text-[10px] text-white italic">
                  {f.mime} · {formatBytes(f.sizeBytes)} ·{" "}
                  {new Date(f.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => open(f.id)}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-[#171717]/20 px-2 py-1 text-[10px] font-medium text-white hover:bg-white/5"
              >
                <IconExternalLink className="h-2.5 w-2.5" />
                Open
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
