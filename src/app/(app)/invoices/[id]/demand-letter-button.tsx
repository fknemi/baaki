import Link from "next/link";

// ─── outline icon ────────────────────────────────────────────────────────────
// Capped at h-4 (16px) — going to h-5 inside the h-11→h-14 button looked
// oversized and disconnected from the label text.

const ICON_STD =
    "h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";

function IconFileText({ className = ICON_STD }: { className?: string }) {
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

// Shared chrome so the disabled and enabled states stay pixel-identical in
// every dimension except colour/cursor. Both must scale together or the
// button visually jumps when the 30-day threshold flips.
const BTN_CLASS =
    "flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#171717]/20 px-3 text-center text-xs font-medium " +
    "sm:h-11 sm:gap-1.5 sm:rounded-lg sm:px-4 sm:text-sm " +
    "md:h-12 md:gap-2 md:rounded-xl md:px-4 md:text-base " +
    "lg:h-12 lg:gap-2 lg:rounded-xl lg:px-5 lg:text-base " +
    "xl:h-14 xl:gap-2.5 xl:rounded-xl xl:px-6 xl:text-lg";

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
                className={`${BTN_CLASS} cursor-not-allowed text-white/50 opacity-60`}
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
            className={`${BTN_CLASS} text-white hover:bg-white/5`}
        >
            <IconFileText />
            Create demand letter
        </Link>
    );
}
