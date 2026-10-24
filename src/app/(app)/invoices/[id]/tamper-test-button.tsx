"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TamperTestButton({ invoiceId, chainSeq }: { invoiceId: string; chainSeq: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onClick() {
    setBusy(true);
    await fetch("/api/dev/tamper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityId: invoiceId,
        chainSeq,
        payload: { tampered: true },
      }),
    });
    setBusy(false);
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <p className="text-xs text-red-600">
        Event #{chainSeq} tampered. Click <strong>Verify this record</strong>.
      </p>
    );
  }

  return (
    <button onClick={onClick} disabled={busy} className="text-xs text-red-600 underline">
      (dev) Tamper event #{chainSeq}
    </button>
  );
}
