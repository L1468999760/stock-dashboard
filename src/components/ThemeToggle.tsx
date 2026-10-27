"use client";

import { useI18n } from "./I18nProvider";

export type ThemeMode = "light" | "dark";

/** 亮/暗小开关:月亮=暗色(默认),太阳=亮色,滑块指示当前模式 */
export default function ThemeToggle({ value, onChange }: { value: ThemeMode; onChange: (v: ThemeMode) => void }) {
  const { t } = useI18n();
  const dark = value === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={t("themeAria")}
      title={dark ? t("themeDark") : t("themeLight")}
      onClick={() => onChange(dark ? "light" : "dark")}
      className="relative flex h-6 w-11 items-center justify-between rounded-full border border-line bg-chip px-1 transition-colors hover:border-faint"
    >
      <span
        className={`pointer-events-none absolute top-0.5 h-5 w-5 rounded-full bg-chip-active transition-all duration-200 ${
          dark ? "left-0.5" : "right-0.5"
        }`}
      />
      {/* 月亮(左=暗色) */}
      <svg
        viewBox="0 0 24 24"
        className={`relative h-3 w-3 ${dark ? "text-fg" : "text-muted"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
      </svg>
      {/* 太阳(右=亮色) */}
      <svg
        viewBox="0 0 24 24"
        className={`relative h-3 w-3 ${dark ? "text-muted" : "text-fg"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    </button>
  );
}
