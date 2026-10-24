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

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

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
    <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
      <h2 className="text-sm font-semibold">Attachments</h2>

      <div className="mt-2">
        <UploadButton
          onUploaded={handleUploaded}
          label="Attach file"
          entityType="invoice"
          entityId={invoiceId}
        />
      </div>

      {busy && <p className="mt-2 text-xs text-[#5A6170]">Verifying…</p>}
      {error && <p className="mt-2 text-xs text-[#B42318]">{error}</p>}

      {files === null && <p className="mt-2 text-xs text-[#5A6170]">Loading…</p>}

      {files !== null && files.length === 0 && (
        <p className="mt-2 text-xs text-[#5A6170]">No attachments yet.</p>
      )}

      {files !== null && files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between rounded border border-[#E4E7EC] p-2 text-xs"
            >
              <div className="min-w-0">
                <div className="truncate font-mono text-[10px] text-[#5A6170]">
                  {f.storageKey.split("/").pop()}
                </div>
                <div className="text-[10px] text-[#5A6170]">
                  {f.mime} · {formatBytes(f.sizeBytes)} ·{" "}
                  {new Date(f.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => open(f.id)}
                className="ml-2 shrink-0 rounded-lg border border-[#E4E7EC] px-2 py-1 text-[10px] font-medium hover:bg-[#F7F8FA]"
              >
                Open
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
