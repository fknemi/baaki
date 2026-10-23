export function StuckBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
      <div className="font-semibold text-amber-900">People often get stuck here</div>
      <div className="mt-1 text-amber-800">{children}</div>
    </div>
  );
}
