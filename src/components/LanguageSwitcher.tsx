"use client";

import { useEffect, useRef, useState } from "react";
import { LOCALES } from "@/lib/i18n";
import { useI18n } from "./I18nProvider";

/** 右上角语言下拉:简体中文 / 繁體中文 / English,点击外部或 Esc 关闭 */
export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = LOCALES.find((l) => l.key === locale) ?? LOCALES[0];
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t("langSwitch")}
        className="flex items-center gap-1 rounded-lg border border-line bg-card px-2 py-1 text-xs text-fg-soft transition-colors hover:border-faint hover:text-fg"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        </svg>
        {current.label}
        <svg
          viewBox="0 0 24 24"
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={t("langSwitch")}
          className="absolute right-0 top-full z-20 mt-1 min-w-[7.5rem] overflow-hidden rounded-lg border border-line bg-card py-1 shadow-lg"
        >
          {LOCALES.map((l) => (
            <button
              key={l.key}
              type="button"
              role="option"
              aria-selected={l.key === locale}
              onClick={() => {
                setLocale(l.key);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-xs transition-colors hover:bg-chip ${
                l.key === locale ? "text-fg" : "text-muted hover:text-fg-soft"
              }`}
            >
              {l.label}
              {l.key === locale && (
                <svg
                  viewBox="0 0 24 24"
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
