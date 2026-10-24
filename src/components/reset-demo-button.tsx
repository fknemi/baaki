"use client";

export function ResetDemoButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (
          window.confirm(
            "Reset demo? This clears all local changes and restores sample data.",
          )
        ) {
          window.location.reload();
        }
      }}
      className="mt-2 rounded-lg border border-[#FDA29B] bg-[#FEF3F2] px-3 py-2 text-xs font-medium text-[#B42318] hover:bg-[#FEE4E2]"
    >
      Reset demo
    </button>
  );
}
