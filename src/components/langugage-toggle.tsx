"use client";

import { useEffect, useState } from "react";
import { getLang, setLang, type Lang } from "@/lib/i18n/t";

export function LanguageToggle() {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    setLangState(getLang());
  }, []);

  function toggle() {
    const next: Lang = lang === "hi" ? "en" : "hi";
    setLang(next);
    setLangState(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded px-2 py-1 text-xs font-medium text-[#5A6170] hover:bg-[#F7F8FA]"
      aria-label={`Switch language to ${lang === "hi" ? "English" : "Hindi"}`}
    >
      {lang === "hi" ? "EN" : "हिं"}
    </button>
  );
}
