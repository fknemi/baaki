// src/app/pay/[token]/page.tsx
import { Suspense } from "react";
import PayClient from "./client";

export default function PayPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md p-6 text-center text-xs text-[#5A6170]">Loading…</main>
      }
    >
      <PayClient />
    </Suspense>
  );
}
