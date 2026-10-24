"use client";

import { useRef, useState } from "react";

async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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
        className="w-full rounded-lg bg-[#0F5C4E] px-4 py-3 text-sm font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
      >
        {busy ? "Uploading…" : `📎 ${label}`}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
      {error && <p className="mt-2 text-xs text-[#B42318]">{error}</p>}
    </div>
  );
}
