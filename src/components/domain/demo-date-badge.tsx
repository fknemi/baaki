"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function DemoDateBadge() {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/demo-date")
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.today) setToday(j.data.today);
      })
      .catch(() => {});
  }, []);

  if (!today) return null;

  return (
    <Link
      href="/settings#demo-date"
      className="rounded bg-[#FFFAEB] px-2 py-0.5 text-[10px] font-medium text-[#B54708] hover:bg-[#FEDF89]"
      aria-label={`Demo date: ${today}. Click to change.`}
    >
      {today}
    </Link>
  );
}
