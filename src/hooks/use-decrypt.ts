import { useEffect, useRef, useState } from 'react';

const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const DEVANAGARI = 'अआइईउऊकखगघचछजझटठडढणतथदधनपफबभमयरलवशषसह';

function randChar(target: string) {
    const set = /[\u0900-\u097F]/.test(target) ? DEVANAGARI : LATIN;
    return set[Math.floor(Math.random() * set.length)];
}

export function useDecrypt(target: string, delayMs = 0, intervalMs = 80): string {
    const [display, setDisplay] = useState(target);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevTarget = useRef(target);

    useEffect(() => {
        if (target === prevTarget.current) return;
        prevTarget.current = target;

        if (timerRef.current) clearInterval(timerRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        timeoutRef.current = setTimeout(() => {
            const chars = [...target];
            const revealed = new Array(chars.length).fill(false);
            let done = 0;
            const nonSpaces = chars.filter(c => c !== ' ').length;

            timerRef.current = setInterval(() => {
                const indices = chars
                    .map((_, i) => i)
                    .filter(i => !revealed[i] && chars[i] !== ' ');

                setDisplay(
                    chars.map((c, i) => {
                        if (c === ' ' || revealed[i]) return c;
                        return randChar(c);
                    }).join('')
                );

                const toReveal = Math.max(1, Math.floor(indices.length * 0.03));
                indices.sort(() => Math.random() - 0.5).slice(0, toReveal).forEach(i => {
                    revealed[i] = true;
                    done++;
                });

                if (done >= nonSpaces) {
                    clearInterval(timerRef.current!);
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
