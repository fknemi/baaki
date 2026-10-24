import Link from "next/link";

export function DemandLetterButton({
  invoiceId,
  daysOverdue,
}: {
  invoiceId: string;
  daysOverdue: number;
}) {
  const available = daysOverdue >= 30;

  if (!available) {
    return (
      <div
        className="cursor-not-allowed rounded-lg bg-white px-4 py-3 text-center text-sm font-medium text-[#5A6170] opacity-50 ring-1 ring-[#E4E7EC]"
        title={`Enabled only after 30 days overdue (currently ${daysOverdue} days)`}
        aria-disabled="true"
      >
        📄 Demand letter
      </div>
    );
  }

  return (
    <Link
      href={`/print/letter/${invoiceId}`}
      target="_blank"
      className="rounded-lg bg-white px-4 py-3 text-center text-sm font-medium ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA]"
    >
      📄 Create demand letter
    </Link>
  );
}
