"use client";

import type { GoldSource } from "@/lib/market";

const OPTIONS: Array<{ key: GoldSource; label: string }> = [
  { key: "cn", label: "国内" },
  { key: "intl", label: "国际" },
];

export default function GoldToggle({ value, onChange }: { value: GoldSource; onChange: (v: GoldSource) => void }) {
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
          {o.label}
        </button>
      ))}
    </div>
  );
}
