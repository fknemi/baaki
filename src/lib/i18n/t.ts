"use client";

import { useSyncExternalStore } from "react";
import { en, type I18nKey } from "./en";
import { hi } from "./hi";

export type Lang = "en" | "hi";

const LANG_KEY = "baaki.lang";

let _lang: Lang = "en";
const listeners = new Set<() => void>();

function readInitialLang(): Lang {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LANG_KEY);
  return stored === "hi" ? "hi" : "en";
}

if (typeof window !== "undefined") {
  _lang = readInitialLang();
}

export function setLang(lang: Lang) {
  _lang = lang;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang === "hi" ? "hi" : "en";
  }
  listeners.forEach((l) => l());
}

export function getLang(): Lang {
  return _lang;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useT() {
  const lang = useSyncExternalStore(
    subscribe,
    () => _lang,
    () => "en" as Lang,
  );

  return function t(
    key: I18nKey,
    vars?: Record<string, string | number>,
  ): string {
    const dict = lang === "hi" ? hi : en;
    let str = dict[key] ?? en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return str;
  };
}
