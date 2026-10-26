"use client";

export type ThemeMode = "light" | "dark" | "system";

const OPTIONS: Array<{ key: ThemeMode; label: string }> = [
  { key: "light", label: "亮色" },
  { key: "dark", label: "暗色" },
  { key: "system", label: "系统" },
];

export default function ThemeToggle({ value, onChange }: { value: ThemeMode; onChange: (v: ThemeMode) => void }) {
  return (
    <div className="flex gap-0.5 rounded-md bg-chip p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          title={o.key === "system" ? "跟随系统" : o.label}
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
