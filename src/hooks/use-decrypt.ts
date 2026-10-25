import { useEffect, useRef, useState } from 'react';

const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const DEVANAGARI = 'अआइईउऊकखगघचछजझटठडढणतथदधनपफबभमयरलवशषसह';

type Script = 'latin' | 'devanagari';

const scriptOf = (s: string): Script =>
  /[\u0900-\u097F]/.test(s) ? 'devanagari' : 'latin';

const setOf = (s: Script): string => (s === 'devanagari' ? DEVANAGARI : LATIN);

const randFrom = (set: string): string => set[Math.floor(Math.random() * set.length)]!;
const scramble = (s: string): string => {
  const set = setOf(scriptOf(s));
  return [...s].map(c => (c === ' ' ? c : randFrom(set))).join('');
};

export function useDecrypt(target: string, delayMs = 0, intervalMs = 80): string {
  const [display, setDisplay] = useState<string>(() => scramble(target));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTarget = useRef<string | null>(null);

  useEffect(() => {
    if (prevTarget.current === target) return;

    const from = prevTarget.current ?? '';
    prevTarget.current = target;

    if (timerRef.current) clearInterval(timerRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      const chars = [...target];
      const toScript = scriptOf(target);
      const toSet = setOf(toScript);
      const fromSet = from ? setOf(scriptOf(from)) : toSet;
      const crossing = fromSet !== toSet;

      const revealed = chars.map(() => false);
      const nonSpaces = chars.filter(c => c !== ' ').length;
      let done = 0;

      timerRef.current = setInterval(() => {
        const progress = nonSpaces === 0 ? 1 : done / nonSpaces;

        setDisplay(
          chars.map((c, i) => {
            if (c === ' ' || revealed[i]) return c;
            // cross-script: early frames favour the old script,
            // late frames favour the new — reads as a language switch
            const useFrom = crossing && Math.random() < 0.6 * (1 - progress);
            return randFrom(useFrom ? fromSet : toSet);
          }).join('')
        );

        const pending = chars
          .map((_, i) => i)
          .filter(i => !revealed[i] && chars[i] !== ' ');

        const toReveal = Math.max(1, Math.floor(pending.length * 0.03));
        pending
          .sort(() => Math.random() - 0.5)
          .slice(0, toReveal)
          .forEach(i => {
            revealed[i] = true;
            done++;
          });

        if (done >= nonSpaces) {
          if (timerRef.current) clearInterval(timerRef.current);
          setDisplay(target);
        }
      }, intervalMs);
    }, delayMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [target, delayMs, intervalMs]);

  return display;
}
