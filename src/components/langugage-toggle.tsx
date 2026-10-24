'use client';

import { Fragment } from 'react';
import { LOCALES, LOCALE_LABELS, useLocale, useSetLocale } from '@/lib/i18n/t';

export function LanguageToggle() {
  const locale = useLocale();
  const setLocale = useSetLocale();

  return (
    <div
      role="group"
      aria-label="Language"
      className="bg-white/5 border-2 border-white/5 flex flex-row items-center gap-2 rounded-sm py-xs px-2"
    >
      {LOCALES.map((loc, i) => {
        const active = locale === loc;
        const isLast = i === LOCALES.length - 1;

        return (
          <Fragment key={loc}>
            <button
              type="button"
              onClick={() => setLocale(loc)}
              aria-pressed={active}
              lang={loc}
              className={`relative flex items-center h-5 leading-none px-1 transition-colors duration-200 motion-reduce:transition-none ${
                active ? 'text-white' : 'text-white/60 hover:text-white/80'
              }`}
            >
              {LOCALE_LABELS[loc]}

              {/* Animated underline */}
              <span
                aria-hidden
                className={`absolute left-1 right-1 bottom-0 h-px bg-white origin-left transition-transform duration-300 ease-out motion-reduce:transition-none ${
                  active ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </button>

            {!isLast && (
              <span
                aria-hidden
                className="h-2 w-px bg-white/[0.05] self-center"
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
