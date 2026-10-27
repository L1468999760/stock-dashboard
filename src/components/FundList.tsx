"use client";

import { useState } from "react";
import type { AssetKey } from "@/lib/market";
import type { ActiveFundInfo } from "@/lib/funds";

export interface FundInfo {
  code: string;
  name: string;
  asset: AssetKey;
  status: "open" | "limited" | "suspended" | "unknown";
  limitYuan: number | null;
  note: string;
}

const GROUPS: { asset: AssetKey; label: string }[] = [
  { asset: "ndx", label: "纳斯达克100" },
  { asset: "spx", label: "标普500" },
];

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  open: { label: "开放申购", cls: "bg-down/15 text-down" },
  limited: { label: "限大额", cls: "bg-amber-400/15 text-amber-400" },
  suspended: { label: "暂停申购", cls: "bg-up/15 text-up" },
  unknown: { label: "未知", cls: "bg-chip/60 text-muted" },
};

function formatLimit(v: number | null): string {
  if (v === null) return "无上限";
  if (v === 0) return "—";
  return v >= 10000
    ? `${(v / 10000).toLocaleString("zh-CN", { maximumFractionDigits: 2 })} 万元`
    : `${v.toLocaleString("zh-CN")} 元`;
}

const limitText = (status: string, v: number | null) =>
  status === "suspended" ? "暂停申购" : status === "limited" && v === null ? "限额未披露" : formatLimit(v);

type ActiveSortKey = "limit" | "change" | "us" | "size";

const ACTIVE_SORTS: { key: ActiveSortKey; label: string }[] = [
  { key: "limit", label: "限额" },
  { key: "change", label: "涨跌幅" },
  { key: "us", label: "美股占比" },
  { key: "size", label: "基金规模" },
];

export default function FundList({ funds, activeFunds }: { funds: FundInfo[]; activeFunds: ActiveFundInfo[] }) {
  const [activeSort, setActiveSort] = useState<ActiveSortKey>("change");
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {GROUPS.map(({ asset, label }) => {
        // 只展示 开放+限额;开放(无上限)与高额度排前面
        const rank = (f: FundInfo) => (f.status === "open" ? Infinity : f.limitYuan ?? -1);
        const rows = funds
          .filter((f) => f.asset === asset && (f.status === "open" || f.status === "limited"))
          .sort((a, b) => rank(b) - rank(a));
        return (
          <div key={asset} className="rounded-xl border border-line bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium text-fg">{label}</h3>
              <span className="text-xs text-muted">{rows.length} 只可申购</span>
            </div>
            {rows.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted">暂无开放或限额申购的基金</div>
            ) : (
              <div className="space-y-0.5">
                {rows.map((f) => {
                  const st = STATUS_STYLE[f.status];
                  return (
                    <a
                      key={f.code}
                      href={`https://fund.eastmoney.com/${f.code}.html`}
                      target="_blank"
                      rel="noreferrer"
                      title={f.note}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-chip/60"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm text-fg">{f.name}</div>
                        <div className="text-[11px] text-muted">{f.code}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-fg">
                          {limitText(f.status, f.limitYuan)}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {(() => {
        // 开放+限额正常展示;暂停申购灰显保留(天天基金代销口径,直销渠道可能仍可买);仅抓取失败隐藏
        const rankA = (f: ActiveFundInfo) => (f.status === "open" ? Infinity : f.limitYuan ?? -1);
        const sorters: Record<ActiveSortKey, (a: ActiveFundInfo, b: ActiveFundInfo) => number> = {
          limit: (a, b) => rankA(b) - rankA(a),
          change: (a, b) => (b.dayChangePct ?? -Infinity) - (a.dayChangePct ?? -Infinity),
          us: (a, b) => (b.region?.us ?? -1) - (a.region?.us ?? -1),
          size: (a, b) => (b.fundSizeYi ?? -1) - (a.fundSizeYi ?? -1),
        };
        const activeRows = activeFunds
          .filter((f) => f.status !== "unknown")
          .sort(sorters[activeSort]);
        const buyableCount = activeRows.filter((f) => f.status !== "suspended").length;
        if (activeRows.length === 0) return null;
        return (
          <div className="rounded-xl border border-line bg-card p-4 md:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium text-fg">纳斯达克主动基金</h3>
              <div className="flex gap-1 rounded-lg bg-chip/80 p-0.5">
                {ACTIVE_SORTS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setActiveSort(s.key)}
                    className={`rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                      activeSort === s.key ? "bg-chip-active text-fg" : "text-muted hover:text-fg-soft"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-1 text-xs text-muted">
              {buyableCount} 只可申购 · 涨跌幅为最新净值日增长(QDII 为 T-1)
            </div>
            <div className="space-y-0.5">
              {activeRows.map((f) => {
              const st = STATUS_STYLE[f.status] ?? STATUS_STYLE.unknown;
              const pct = f.dayChangePct;
              return (
                <a
                  key={f.code}
                  href={`https://fund.eastmoney.com/${f.code}.html`}
                  target="_blank"
                  rel="noreferrer"
                  title={f.note}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-chip/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm ${f.status === "suspended" ? "text-muted" : "text-fg"}`}>{f.name}</div>
                    <div className="text-[11px] text-muted">
                      {f.code}
                      {f.fundSizeYi != null && (
                        <span title={`期末净资产 ${f.fundSizeYi} 亿元(${f.sizeDate || "最新一期"})`}>
                          {" · "}
                          {f.fundSizeYi >= 100
                            ? Math.round(f.fundSizeYi)
                            : f.fundSizeYi >= 10
                              ? f.fundSizeYi.toFixed(1)
                              : f.fundSizeYi.toFixed(2)}
                          亿
                        </span>
                      )}
                      {f.region && (
                        <span
                          className="ml-1 text-muted"
                          title={`全持仓区域分布,占净值比(按${f.holdingsDate || "最新"}中报/年报合计)`}
                        >
                          {(
                            [
                              ["美股", f.region.us],
                              ["港股", f.region.hk],
                              ["A股", f.region.cn],
                              ["其它", f.region.other],
                            ] as const
                          )
                            .filter(([, v]) => v > 0)
                            .map(([k, v]) => ` · ${k} ${v}%`)
                            .join("") || " · 持仓未披露区域"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`w-16 shrink-0 text-right text-sm font-semibold tabular-nums sm:w-20 ${pct == null ? "text-muted" : pct >= 0 ? "text-up" : "text-down"}`}>
                    {pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`}
                    <span className="block text-[10px] font-normal text-faint">{f.navDate}</span>
                  </div>
                  <div className="flex shrink-0 items-center justify-end gap-2 sm:w-32">
                    <span className="text-sm font-semibold tabular-nums text-fg">
                      {limitText(f.status, f.limitYuan)}
                    </span>
                    <span className={`hidden rounded px-1.5 py-0.5 text-[11px] font-medium sm:inline-block ${st.cls}`}>{st.label}</span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
        );
      })()}
    </div>
  );
}
