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

// ─── shared styles ───────────────────────────────────────────────────────────

// Card chrome — radius + padding ladder matches every other card in the app.
const CARD =
    "rounded-lg border border-white/10 p-3 sm:rounded-xl sm:p-4 md:rounded-xl md:p-4 lg:rounded-2xl lg:p-5 xl:rounded-2xl xl:p-5";

// Pill / chip chrome. Height grows via explicit h-* (not py-*) so every
// group member is the same height at every breakpoint, and text grows in
// lockstep so the box never stretches while the label stays tiny.
const PILL_BASE =
    "flex items-center justify-center rounded-lg font-medium " +
    "h-8 px-3 text-xs " +
    "sm:h-9 sm:px-3.5 sm:text-sm " +
    "md:h-10 md:px-4 md:text-sm " +
    "lg:h-10 lg:px-4 lg:text-base " +
    "xl:h-11 xl:px-4 xl:text-base";
const PILL_ACTIVE = `${PILL_BASE} bg-[#0F5C4E] text-white`;
const PILL_INACTIVE = `${PILL_BASE} border border-white/10 bg-[#171717]/20 text-white hover:bg-white/5`;
const CHIP = `${PILL_BASE} border border-white/10 bg-[#171717]/20 text-white hover:bg-white/5`;

// Section heading ladder — mirrors the settings tiles above.
const SECTION_H3 =
    "font-semibold text-white text-sm sm:text-base md:text-base lg:text-lg xl:text-lg";

// Row wrapper for pill groups.
const PILL_ROW =
    "flex flex-wrap gap-2 sm:gap-2 md:gap-2.5 lg:gap-3 xl:gap-3";

// Body text ladder for the demo-date status line and checkbox label.
const BODY_TEXT =
    "text-xs sm:text-xs md:text-sm lg:text-sm xl:text-base";

// Checkbox size ladder.
const CHECKBOX =
    "accent-[#0F5C4E] h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-5 xl:w-5";

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
        // auto-rows-fr — every grid row resolves to the height of the
        // tallest card (Demo date, with its chips row + status line), so
        // all four cards are the same height, not just the two per row.
        // Grid goes 1-col → 2×2 at md, keeping the section parity with
        // the four tiles above it on the settings page.
        <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:gap-3 md:grid-cols-2 md:gap-4 lg:gap-4 xl:gap-5">
            <section className={CARD}>
                <h3 className={SECTION_H3}>{dLanguage}</h3>
                <div className={`mt-2 sm:mt-2 md:mt-2.5 lg:mt-3 xl:mt-3 ${PILL_ROW}`}>
                    <button
                        onClick={() => changeLang("en")}
                        className={locale === "en" ? PILL_ACTIVE : PILL_INACTIVE}
                    >
                        {dLangEn}
                    </button>
                    <button
                        onClick={() => changeLang("hi")}
                        className={locale === "hi" ? PILL_ACTIVE : PILL_INACTIVE}
                    >
                        {dLangHi}
                    </button>
                </div>
            </section>

            <section className={CARD}>
                <h3 className={SECTION_H3}>{dTextSize}</h3>
                <div className={`mt-2 sm:mt-2 md:mt-2.5 lg:mt-3 xl:mt-3 ${PILL_ROW}`}>
                    {([100, 115, 130] as TextSize[]).map((s) => (
                        <button
                            key={s}
                            onClick={() => changeSize(s)}
                            className={size === s ? PILL_ACTIVE : PILL_INACTIVE}
                        >
                            {sizeLabels[s]}
                        </button>
                    ))}
                </div>
            </section>

            <section className={CARD}>
                <h3 className={SECTION_H3}>
                    {dHighContrast}
                </h3>
                <label
                    className={`mt-2 flex cursor-pointer items-center gap-2 sm:mt-2 sm:gap-2 md:mt-2.5 md:gap-2.5 lg:mt-3 lg:gap-3 xl:mt-3 xl:gap-3 ${BODY_TEXT}`}
                >
                    <input
                        type="checkbox"
                        checked={contrast ?? false}
                        onChange={(e) => changeContrast(e.target.checked)}
                        className={CHECKBOX}
                    />
                    <span className="text-white">{dHighContrast}</span>
                </label>
            </section>

            <section className={CARD}>
                <h3 className={SECTION_H3}>{dDemoDate}</h3>
                <div className={`mt-2 sm:mt-2 md:mt-2.5 lg:mt-3 xl:mt-3 ${PILL_ROW}`}>
                    <button onClick={() => demoChip(7)} className={CHIP}>
                        {dPlus7}
                    </button>
                    <button onClick={() => demoChip(15)} className={CHIP}>
                        {dPlus15}
                    </button>
                    <button onClick={() => demoChip(30)} className={CHIP}>
                        {dPlus30}
                    </button>
                    <button onClick={() => void setDemoDate("")} className={CHIP}>
                        {dToday}
                    </button>
                </div>
                {demoDate && (
                    <p
                        className={`mt-2 italic text-white sm:mt-2 md:mt-2.5 lg:mt-3 xl:mt-3 ${BODY_TEXT}`}
                    >
                        {dDemoDate}: <span className="font-mono">{demoDate}</span>
                    </p>
                )}
            </section>
        </div>
    );
}
