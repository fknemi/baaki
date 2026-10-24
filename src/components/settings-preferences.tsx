"use client";

import { useEffect, useState } from "react";
import { useT, setLang, getLang } from "@/lib/i18n/t";

type TextSize = 100 | 115 | 130;
const TEXT_KEY = "baaki.textSize";
const CONTRAST_KEY = "baaki.highContrast";
const DEMO_DATE_KEY = "baaki.demoDate";

function readTextSize(): TextSize {
  if (typeof window === "undefined") return 100;
  const v = Number(window.localStorage.getItem(TEXT_KEY));
  return v === 115 || v === 130 ? v : 100;
}

function applyTextSize(size: TextSize) {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = `${size}%`;
}

function applyContrast(on: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("contrast-high", on);
}

export function SettingsPreferences() {
  const t = useT();
  const [lang, setLangState] = useState<"en" | "hi">("en");
  const [size, setSizeState] = useState<TextSize>(100);
  const [contrast, setContrastState] = useState(false);
  const [demoDate, setDemoDateState] = useState<string>("");

  useEffect(() => {
    setLangState(getLang());
    const s = readTextSize();
    setSizeState(s);
    applyTextSize(s);
    const c = window.localStorage.getItem(CONTRAST_KEY) === "true";
    setContrastState(c);
    applyContrast(c);
    setDemoDateState(window.localStorage.getItem(DEMO_DATE_KEY) ?? "");
  }, []);

  function changeLang(l: "en" | "hi") {
    setLang(l);
    setLangState(l);
  }

  function changeSize(s: TextSize) {
    setSizeState(s);
    applyTextSize(s);
    window.localStorage.setItem(TEXT_KEY, String(s));
  }

  function changeContrast(on: boolean) {
    setContrastState(on);
    applyContrast(on);
    window.localStorage.setItem(CONTRAST_KEY, String(on));
  }

  function setDemoDate(dateStr: string) {
    setDemoDateState(dateStr);
    if (dateStr) window.localStorage.setItem(DEMO_DATE_KEY, dateStr);
    else window.localStorage.removeItem(DEMO_DATE_KEY);
  }

  function demoChip(offset: number) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    setDemoDate(d.toISOString().slice(0, 10));
  }

  return (
    <div className="space-y-3">
      <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
        <h3 className="text-sm font-semibold">{t("settings_language")}</h3>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => changeLang("en")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              lang === "en"
                ? "bg-[#0F5C4E] text-white"
                : "bg-white text-[#5A6170] ring-1 ring-[#E4E7EC]"
            }`}
          >
            {t("settings_language_en")}
          </button>
          <button
            onClick={() => changeLang("hi")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              lang === "hi"
                ? "bg-[#0F5C4E] text-white"
                : "bg-white text-[#5A6170] ring-1 ring-[#E4E7EC]"
            }`}
          >
            {t("settings_language_hi")}
          </button>
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
        <h3 className="text-sm font-semibold">{t("settings_text_size")}</h3>
        <div className="mt-2 flex gap-2">
          {([100, 115, 130] as TextSize[]).map((s) => (
            <button
              key={s}
              onClick={() => changeSize(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                size === s
                  ? "bg-[#0F5C4E] text-white"
                  : "bg-white text-[#5A6170] ring-1 ring-[#E4E7EC]"
              }`}
            >
              {s === 100
                ? t("settings_text_size_100")
                : s === 115
                  ? t("settings_text_size_115")
                  : t("settings_text_size_130")}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
        <h3 className="text-sm font-semibold">{t("settings_high_contrast")}</h3>
        <label className="mt-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={contrast}
            onChange={(e) => changeContrast(e.target.checked)}
          />
          <span>Enable high-contrast mode</span>
        </label>
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
        <h3 className="text-sm font-semibold">{t("settings_demo_date")}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={() => demoChip(7)}
            className="rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-xs font-medium hover:bg-[#F7F8FA]"
          >
            {t("settings_demo_plus7")}
          </button>
          <button
            onClick={() => demoChip(15)}
            className="rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-xs font-medium hover:bg-[#F7F8FA]"
          >
            {t("settings_demo_plus15")}
          </button>
          <button
            onClick={() => demoChip(30)}
            className="rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-xs font-medium hover:bg-[#F7F8FA]"
          >
            {t("settings_demo_plus30")}
          </button>
          <button
            onClick={() => setDemoDate("")}
            className="rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-xs font-medium hover:bg-[#F7F8FA]"
          >
            {t("settings_demo_today")}
          </button>
        </div>
        {demoDate && (
          <p className="mt-2 text-xs text-[#5A6170]">
            Demo date: <span className="font-mono">{demoDate}</span>
          </p>
        )}
      </section>
    </div>
  );
}
