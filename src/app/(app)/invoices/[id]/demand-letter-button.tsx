import Link from "next/link";

// ─── outline icon ────────────────────────────────────────────────────────────

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

export function DemandLetterButton({
  invoiceId,
  daysOverdue,
}: {
  invoiceId: string;
  daysOverdue: number;
}) {
  const available = daysOverdue >= 30;

  if (!available) {
    // A disabled <button> instead of a <div>: a <div> can't be focused or
    // reached by keyboard, so a keyboard/screen-reader user would have no
    // way to discover this control exists at all. aria-disabled on a <div>
    // doesn't fix that — only a real disabled form control does.
    return (
      <button
        type="button"
        disabled
        title={`Enabled only after 30 days overdue (currently ${daysOverdue} days)`}
        className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#171717]/20 px-4 text-center text-xs font-medium text-white/50 opacity-60"
      >
        <IconFileText />
        Demand letter
      </button>
    );
  }

  return (
    <Link
      href={`/print/letter/${invoiceId}`}
      target="_blank"
      className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#171717]/20 px-4 text-center text-sm font-medium text-white hover:bg-white/5"
    >
      <IconFileText />
      Create demand letter
    </Link>
  );
}
