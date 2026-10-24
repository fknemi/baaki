"use client";

export function PrintControls({ showInterest = false }: { showInterest?: boolean }) {
  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-3">
      <button
        onClick={() => window.print()}
        className="rounded bg-[#0F5C4E] px-3 py-2 text-sm font-medium text-white hover:bg-[#0F5C4E]/90"
      >
        Print / Save as PDF
      </button>
      {showInterest && <InterestToggle />}
    </div>
  );
}

function InterestToggle() {
  function handleChange(checked: boolean) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (checked) url.searchParams.set("includeInterest", "true");
    else url.searchParams.delete("includeInterest");
    // Full reload so the server component re-fetches with the new param
    window.location.href = url.toString();
  }

  // Read initial state from the URL on mount (client-side)
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const initial = params?.get("includeInterest") === "true";

  return (
    <label className="flex items-center gap-2 text-xs text-[#5A6170]">
      <input
        type="checkbox"
        defaultChecked={initial}
        onChange={(e) => handleChange(e.target.checked)}
      />
      Include MSMED compound interest in this demand
    </label>
  );
}
