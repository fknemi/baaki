"use client";

import { useEffect, useRef, useState } from "react";
import { useSetLocale, useLocale, useT } from '@/lib/i18n/t';

type TextSize = 100 | 115 | 130;
const TEXT_KEY = "baaki.textSize";
const CONTRAST_KEY = "baaki.highContrast";

import { useDecrypt } from '@/hooks/use-decrypt';
function randChar(target: string) {
    const set = /[\u0900-\u097F]/.test(target) ? DEVANAGARI : LATIN;
    return set[Math.floor(Math.random() * set.length)];
}


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
    const locale = useLocale();
    const setLocale = useSetLocale();
    const t = useT();
    const [size, setSizeState] = useState<TextSize | null>(null);
    const [contrast, setContrastState] = useState<boolean | null>(null);
    const [demoDate, setDemoDateState] = useState<string>("");

    const dLanguage = useDecrypt(t("settings.language"), 0);
    const dLangEn = useDecrypt(t("settings.language_en"), 40);
    const dLangHi = useDecrypt(t("settings.language_hi"), 80);
    const dTextSize = useDecrypt(t("settings.text_size"), 60);
    const dSize100 = useDecrypt(t("settings.text_size_100"), 100);
    const dSize115 = useDecrypt(t("settings.text_size_115"), 130);
    const dSize130 = useDecrypt(t("settings.text_size_130"), 160);
    const dHighContrast = useDecrypt(t("settings.high_contrast"), 80);
    const dDemoDate = useDecrypt(t("settings.demo_date"), 100);
    const dPlus7 = useDecrypt(t("settings.demo_plus7"), 130);
    const dPlus15 = useDecrypt(t("settings.demo_plus15"), 160);
    const dPlus30 = useDecrypt(t("settings.demo_plus30"), 190);
    const dToday = useDecrypt(t("settings.demo_today"), 220);

    useEffect(() => {
        const stored = readTextSize();
        setSizeState(stored);
        applyTextSize(stored);

        const highContrast = window.localStorage.getItem(CONTRAST_KEY) === "true";
        setContrastState(highContrast);
        applyContrast(highContrast);

        fetch("/api/admin/demo-date")
            .then((r) => r.json())
            .then((j) => setDemoDateState(j?.data?.override ?? ""))
            .catch(() => { });
    }, []);

    function changeLang(l: "en" | "hi") {
        setLocale(l);
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

    async function setDemoDate(dateStr: string) {
        setDemoDateState(dateStr);
        try {
            await fetch("/api/admin/demo-date", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: dateStr || null }),
            });
        } catch {
            /* ignore */
        }
    }

    function demoChip(offset: number) {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        void setDemoDate(d.toISOString().slice(0, 10));
    }

    const sizeLabels: Record<TextSize, string> = {
        100: dSize100,
        115: dSize115,
        130: dSize130,
    };

    return (
        <div className="space-y-3">
            <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
                <h3 className="text-sm font-semibold">{dLanguage}</h3>
                <div className="mt-2 flex gap-2">
                    <button
                        onClick={() => changeLang("en")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${locale === "en"
                            ? "bg-[#0F5C4E] text-white"
                            : "bg-white text-[#5A6170] ring-1 ring-[#E4E7EC]"
                            }`}
                    >
                        {dLangEn}
                    </button>
                    <button
                        onClick={() => changeLang("hi")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${locale === "hi"
                            ? "bg-[#0F5C4E] text-white"
                            : "bg-white text-[#5A6170] ring-1 ring-[#E4E7EC]"
                            }`}
                    >
                        {dLangHi}
                    </button>
                </div>
            </section>

            <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
                <h3 className="text-sm font-semibold">{dTextSize}</h3>
                <div className="mt-2 flex gap-2">
                    {([100, 115, 130] as TextSize[]).map((s) => (
                        <button
                            key={s}
                            onClick={() => changeSize(s)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${size === s
                                ? "bg-[#0F5C4E] text-white"
                                : "bg-white text-[#5A6170] ring-1 ring-[#E4E7EC]"
                                }`}
                        >
                            {sizeLabels[s]}
                        </button>
                    ))}
                </div>
            </section>

            <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
                <h3 className="text-sm font-semibold">{dHighContrast}</h3>
                <label className="mt-2 flex items-center gap-2 text-xs">
                    <input
                        type="checkbox"
                        checked={contrast ?? false}
                        onChange={(e) => changeContrast(e.target.checked)}
                    />
                    <span>{dHighContrast}</span>
                </label>
            </section>

            <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
                <h3 className="text-sm font-semibold">{dDemoDate}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                    <button
                        onClick={() => demoChip(7)}
                        className="rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-xs font-medium hover:bg-[#F7F8FA]"
                    >
                        {dPlus7}
                    </button>
                    <button
                        onClick={() => demoChip(15)}
                        className="rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-xs font-medium hover:bg-[#F7F8FA]"
                    >
                        {dPlus15}
                    </button>
                    <button
                        onClick={() => demoChip(30)}
                        className="rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-xs font-medium hover:bg-[#F7F8FA]"
                    >
                        {dPlus30}
                    </button>
                    <button
                        onClick={() => void setDemoDate("")}
                        className="rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-xs font-medium hover:bg-[#F7F8FA]"
                    >
                        {dToday}
                    </button>
                </div>
                {demoDate && (
                    <p className="mt-2 text-xs text-[#5A6170]">
                        {dDemoDate}: <span className="font-mono">{demoDate}</span>
                    </p>
                )}
            </section>
        </div>
    );
}
