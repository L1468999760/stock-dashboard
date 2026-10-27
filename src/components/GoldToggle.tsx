"use client";

import type { GoldSource } from "@/lib/market";
import type { Key } from "@/lib/i18n";
import { useI18n } from "./I18nProvider";

const OPTIONS: Array<{ key: GoldSource; label: Key }> = [
  { key: "cn", label: "goldCn" },
  { key: "intl", label: "goldIntl" },
];

export default function GoldToggle({ value, onChange }: { value: GoldSource; onChange: (src: GoldSource) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex gap-0.5 rounded-md bg-chip p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`rounded px-2 py-0.5 text-[11px] leading-4 transition-colors ${
            value === o.key ? "bg-chip-active text-fg" : "text-muted hover:text-fg-soft"
          }`}
        >
          {t(o.label)}
        </button>
      ))}
    </div>
  );
}
