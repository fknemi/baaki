// src/lib/i18n/t.ts
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import en, { type Dict } from "./en";
import hi from "./hi";

// ─── Locale registry ─────────────────────────────────────────────────
export type Locale = "en" | "hi";
export const LOCALES = ["hi", "en"] as const satisfies readonly Locale[];
export const LOCALE_LABELS: Record<Locale, string> = {
    en: "EN",
    hi: "HI",
};
export const DEFAULT_LOCALE: Locale = "en";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DICTIONARIES: Record<Locale, any> = { en, hi };
// ─── Dotted-path key type, derived from the en dictionary ────────────
type DotPath<T, P extends string = ""> = {
    [K in keyof T & string]: T[K] extends string
    ? P extends ""
    ? K
    : `${P}.${K}`
    : T[K] extends Record<string, unknown>
    ? DotPath<T[K], P extends "" ? K : `${P}.${K}`>
    : never;
}[keyof T & string];

export type TKey = DotPath<Dict>;
export type TVars = Record<string, string | number>;

// ─── Lookup + interpolation ──────────────────────────────────────────
function lookup(dict: unknown, path: string): string | undefined {
    let cur: unknown = dict;
    for (const seg of path.split(".")) {
        if (cur && typeof cur === "object" && seg in (cur as Record<string, unknown>)) {
            cur = (cur as Record<string, unknown>)[seg];
        } else return undefined;
    }
    return typeof cur === "string" ? cur : undefined;
}

function interpolate(tpl: string, vars?: TVars): string {
    if (!vars) return tpl;
    return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

// ─── Persistence (localStorage + cookie) ─────────────────────────────
const STORAGE_KEY = "baaki.locale";
const COOKIE_KEY = "baaki.locale";

function isLocale(v: unknown): v is Locale {
    return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

function readStored(): Locale | null {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        return isLocale(v) ? v : null;
    } catch {
        return null;
    }
}

function writeStored(locale: Locale) {
    try {
        localStorage.setItem(STORAGE_KEY, locale);
    } catch {
        /* private mode */
    }
    document.cookie = `${COOKIE_KEY}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

// ─── Context ─────────────────────────────────────────────────────────
interface LocaleContextValue {
    locale: Locale;
    setLocale: (l: Locale) => void;
    t: (key: TKey, vars?: TVars) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

interface LocaleProviderProps {
    children: ReactNode;
    /**
     * Server-read cookie value. Passing this prevents a flash of the
     * default language for returning users. See "SSR flicker" below.
     */
    initialLocale?: Locale;
}

export function LocaleProvider({ children, initialLocale }: LocaleProviderProps) {
    const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

    // After hydration, prefer localStorage (source of truth) over the
    // server-provided cookie in case they disagree (e.g. cookie blocked).
    useEffect(() => {
        const stored = readStored();
        if (stored && stored !== locale) {
            const t = setTimeout(() => setLocaleState(stored), 0);
            return () => clearTimeout(t);
        }
        return undefined; // ✅ Explicitly return undefined when no cleanup is needed
    }, [locale]);
    // Keep <html lang> in sync for a11y / hyphenation / screen readers.
    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

    const setLocale = useCallback((next: Locale) => {
        setLocaleState(next);
        writeStored(next);
        document.documentElement.lang = next;
    }, []);

    const t = useCallback(
        (key: TKey, vars?: TVars) => {
            const hit = lookup(DICTIONARIES[locale], key);
            if (hit) return interpolate(hit, vars);
            const fb = lookup(DICTIONARIES[DEFAULT_LOCALE], key);
            // If the key is missing in both, return the key itself — loud in dev.
            return fb ? interpolate(fb, vars) : key;
        },
        [locale],
    );

    const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

    return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

// ─── Hooks ───────────────────────────────────────────────────────────
function useCtx(): LocaleContextValue {
    const ctx = useContext(LocaleContext);
    if (!ctx) {
        throw new Error("i18n: wrap your tree in <LocaleProvider> (see app/layout.tsx)");
    }
    return ctx;
}

export const useLocale = () => useCtx().locale;
export const useSetLocale = () => useCtx().setLocale;
export const useT = () => useCtx().t;
