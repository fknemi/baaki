export function StepProgress({
  current,
  total,
  labels,
}: {
  current: number;
  total: number;
  labels: string[];
}) {
  return (
    <div>
      <div className="flex items-center">
        {Array.from({ length: total }).map((_, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          return (
            <div key={i} className={`flex items-center ${i < total - 1 ? "flex-1" : ""}`}>
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  active
                    ? "bg-[#0F5C4E] text-white"
                    : done
                      ? "bg-[#0F5C4E]/70 text-white"
                      : "bg-[#E4E7EC] text-[#5A6170]"
                }`}
              >
                {n}
              </div>
              {i < total - 1 && (
                <div className={`mx-1 h-0.5 flex-1 ${done ? "bg-[#0F5C4E]/70" : "bg-[#E4E7EC]"}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 text-center text-[10px] font-semibold text-[#1A1D23]">
        {labels[current - 1]}
      </div>
    </div>
  );
}
