function IconInfo({ className = "h-3.5 w-3.5" }: { className?: string }) {
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
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function StuckBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-[#60A5FA]/40 bg-[#60A5FA]/10 p-3 text-xs text-white"
    >
      <IconInfo className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#60A5FA]" />
      <div>
        <div className="font-semibold text-white">
          People often get stuck here
        </div>
        <div className="mt-1 text-white/80">{children}</div>
      </div>
    </div>
  );
}
