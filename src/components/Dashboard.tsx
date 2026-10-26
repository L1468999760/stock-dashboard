"use client";

import { useCallback, useEffect, useState } from "react";
import type { AssetKey, Quote, GoldSource } from "@/lib/market";
import type { Valuation } from "@/lib/valuation";
import PriceCard from "./PriceCard";
import HistoryChart from "./HistoryChart";
import FundList from "./FundList";
import ThemeToggle, { type ThemeMode } from "./ThemeToggle";
import type { FundInfo, ActiveFundInfo } from "@/lib/funds";

const RANGES = [
  { key: "3m", label: "3个月" },
  { key: "6m", label: "6个月" },
  { key: "1y", label: "1年" },
  { key: "3y", label: "3年" },
];

const ASSET_ORDER: AssetKey[] = ["ndx", "spx", "gold", "dv50"];

export default function Dashboard() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string>("");
  const [funds, setFunds] = useState<FundInfo[]>([]);
  const [activeFunds, setActiveFunds] = useState<ActiveFundInfo[]>([]);
  const [fundsLoading, setFundsLoading] = useState(true);
  const [valuations, setValuations] = useState<Partial<Record<AssetKey, Valuation>>>({});
  const [range, setRange] = useState("1y");
  const [goldSrc, setGoldSrc] = useState<GoldSource>("cn");
  const [refreshing, setRefreshing] = useState(false);
  // 主题:亮/暗/系统,默认暗色;初始值由 layout 内联脚本写在 <html> 上,挂载后同步
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    if (t === "light" || t === "dark" || t === "system") setTheme(t);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const d = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", d);
      setDark(d);
    };
    apply();
    if (theme === "system") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  const refreshQuotes = useCallback(async () => {
    try {
      const r = await fetch("/api/quotes");
      const j = await r.json();
      if (j.error) setQuoteError(j.error);
      else {
        setQuotes(j.quotes);
        setQuoteError(null);
        setFetchedAt(new Date(j.fetchedAt).toLocaleTimeString("zh-CN"));
      }
    } catch (e) {
      setQuoteError(String(e));
    }
  }, []);

  const refreshFunds = useCallback(async () => {
    try {
      const r = await fetch("/api/funds");
      const j = await r.json();
      if (!j.error) {
        setFunds(j.funds ?? []);
        setActiveFunds(j.active ?? []);
      }
    } catch {
      /* 静默:限购区显示空态 */
    } finally {
      setFundsLoading(false);
    }
  }, []);

  // 指数估值(PE)日更,失败静默隐藏徽标
  const refreshValuations = useCallback(async () => {
    try {
      const r = await fetch("/api/valuation");
      const j = await r.json();
      if (!j.error) setValuations(j);
    } catch {
      /* 静默 */
    }
  }, []);

  // 手动刷新:行情 + 限购 + 估值一起拉
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshQuotes(), refreshFunds(), refreshValuations()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshQuotes, refreshFunds, refreshValuations]);

  useEffect(() => {
    refreshQuotes();
    refreshFunds();
    refreshValuations();
    // 行情+限购一起 5 分钟自动刷新(限购状态有服务端缓存,开销低)
    const timer = setInterval(() => {
      refreshQuotes();
      refreshFunds();
    }, 300_000);
    return () => clearInterval(timer);
  }, [refreshQuotes, refreshFunds]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold">
          {/* 站点标志,与 src/app/icon.svg 同款(改动几何请同步 scripts/gen-icons.mjs) */}
          <svg viewBox="0 0 64 64" className="h-7 w-7 shrink-0" aria-hidden="true">
            <defs>
              <linearGradient id="logo-g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#00A3E0" />
                <stop offset="1" stopColor="#00558C" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="14" fill="url(#logo-g)" />
            <path
              d="M13 46 L27 34 L36 40 L46 30"
              fill="none"
              stroke="#fff"
              strokeWidth="6.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M52.7 23.3 L50.6 34.6 L41.4 25.4 Z" fill="#fff" />
          </svg>
          行情与限购看板
        </h1>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted">
            {quoteError ? (
              <span className="text-up">{quoteError}</span>
            ) : (
              <>信息更新于 {fetchedAt} · 5 分钟自动刷新</>
            )}
          </div>
          <ThemeToggle value={theme} onChange={setTheme} />
          <button
            onClick={refreshAll}
            disabled={refreshing}
            className="rounded-lg border border-line-strong bg-card px-3 py-1 text-xs text-fg-soft transition-colors hover:border-faint hover:text-fg disabled:opacity-50"
          >
            {refreshing ? "刷新中…" : "手动刷新"}
          </button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ASSET_ORDER.map((key) => {
          const q =
            key === "gold"
              ? quotes.find((x) => x.key === "gold" && x.src === goldSrc)
              : quotes.find((x) => x.key === key);
          return q ? (
            key === "gold" ? (
              <PriceCard key={key} quote={q} goldSrc={goldSrc} onGoldSrcChange={setGoldSrc} />
            ) : (
              <PriceCard key={key} quote={q} />
            )
          ) : (
            <div key={key} className="h-32 animate-pulse rounded-xl bg-card" />
          );
        })}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">历史走势</h2>
          <div className="flex gap-1 rounded-lg bg-chip p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`rounded-md px-3 py-1 text-xs transition-colors ${
                  range === r.key ? "bg-chip-active text-fg" : "text-muted hover:text-fg-soft"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {ASSET_ORDER.map((key) =>
            key === "gold" ? (
              <HistoryChart
                key={key}
                asset={key}
                range={range}
                goldSrc={goldSrc}
                onGoldSrcChange={setGoldSrc}
                dark={dark}
              />
            ) : (
              <HistoryChart key={key} asset={key} range={range} valuation={valuations[key]} dark={dark} />
            )
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-1 text-lg font-semibold">QDII 基金每日限购额度</h2>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-card px-2 py-1 text-muted">
            开放申购 <span className="font-semibold text-down">{funds.filter((f) => f.status === "open").length}</span>
          </span>
          <span className="rounded bg-card px-2 py-1 text-muted">
            限大额 <span className="font-semibold text-amber-400">{funds.filter((f) => f.status === "limited").length}</span>
          </span>
          <span className="rounded bg-card px-2 py-1 text-muted">
            暂停已隐藏 <span className="font-semibold text-fg-soft">{funds.filter((f) => f.status === "suspended").length}</span>
          </span>
        </div>
        {funds.length + activeFunds.length > 0 ? (
          <FundList funds={funds} activeFunds={activeFunds} />
        ) : fundsLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-48 animate-pulse rounded-xl bg-card" />
            <div className="h-48 animate-pulse rounded-xl bg-card" />
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-card py-8 text-center text-xs text-muted">
            限购数据未加载成功,点右上角「手动刷新」重试
          </div>
        )}
      </section>

      <footer className="mt-10 text-center text-xs text-faint">
        数据来源:腾讯财经 / 新浪财经 / 天天基金 · 仅供参考,不构成投资建议
      </footer>
    </main>
  );
}
