import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        up: "#ef4444",
        down: "#22c55e",
        // 语义色板:亮/暗由 globals.css 的 CSS 变量切换
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        card: "rgb(var(--c-card) / <alpha-value>)",
        chip: "rgb(var(--c-chip) / <alpha-value>)",
        "chip-active": "rgb(var(--c-chip-active) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        "line-strong": "rgb(var(--c-line-strong) / <alpha-value>)",
        fg: "rgb(var(--c-fg) / <alpha-value>)",
        "fg-soft": "rgb(var(--c-fg-soft) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        faint: "rgb(var(--c-faint) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};

export default config;
