"use client";

import { useRef, useState } from "react";

async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── shared button scale ─────────────────────────────────────────────────────
// Matches the primary-button ladder from the OCR page / MarkPaidDialog / the
// action grid on InvoiceDetailPage. Every consumer (OCR upload area,
// AttachmentsSection "Attach file", future surfaces) gets the same button
// footprint at every breakpoint, so it always sits flush with the rest of
// the app instead of rendering as a 44 px midget next to h-12 siblings.

const TRIGGER_CLASS =
  "flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0F5C4E] px-4 text-sm font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50 " +
  "h-11 " +
  "sm:h-11 sm:gap-2 sm:rounded-xl sm:px-5 sm:text-base " +
  "md:h-12 md:gap-2 md:rounded-xl md:px-6 md:text-base " +
  "lg:h-12 lg:gap-2.5 lg:rounded-xl lg:px-6 lg:text-lg " +
  "xl:h-14 xl:gap-2.5 xl:rounded-xl xl:px-8 xl:text-lg";

export function UploadButton({
  onUploaded,
  accept = "image/jpeg,image/png,application/pdf,audio/mpeg,audio/wav",
  label = "Upload a photo",
  entityType = "temp",
  entityId = null,
}: {
  onUploaded: (storageKey: string, sha256: string) => void;
  accept?: string;
  label?: string;
  entityType?: "temp" | "invoice" | "customer" | "business";
  entityId?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large (5 MB max).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const sha256 = await computeSha256(buffer);

      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mime: file.type,
          sizeBytes: file.size,
          entityType,
          entityId,
        }),
      });
      const presignJson = await presignRes.json();
      if (!presignRes.ok) {
        throw new Error(presignJson?.error?.message ?? "Presign failed");
      }
      const { uploadUrl, storageKey } = presignJson.data;

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: buffer,
      });
      if (!putRes.ok) throw new Error("Upload failed");

      onUploaded(storageKey, sha256);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={TRIGGER_CLASS}
      >
        {busy ? "Uploading…" : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
      {error && (
        <p className="mt-2 text-xs text-[#FF9B8F] sm:mt-2 sm:text-xs md:mt-2.5 md:text-sm lg:mt-3 lg:text-sm xl:mt-3 xl:text-base">
          {error}
        </p>
      )}
    </div>
  );
}
