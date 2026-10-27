"use client";

import { useState } from "react";
import type { AssetKey } from "@/lib/market";
import type { ActiveFundInfo, FundStatus } from "@/lib/funds";
import type { Key, Locale, T } from "@/lib/i18n";
import { useI18n } from "./I18nProvider";

export interface FundInfo {
  code: string;
  name: string;
  asset: AssetKey;
  status: FundStatus;
  limitYuan: number | null;
  note: string;
}

const GROUPS: { asset: AssetKey; label: Key }[] = [
  { asset: "ndx", label: "assetNdx" },
  { asset: "spx", label: "assetSpx" },
];

const STATUS_STYLE: Record<FundStatus, string> = {
  open: "bg-down/15 text-down",
  limited: "bg-amber-400/15 text-amber-400",
  suspended: "bg-up/15 text-up",
  unknown: "bg-chip/60 text-muted",
};
const STATUS_LABEL: Record<FundStatus, Key> = {
  open: "statusOpen",
  limited: "statusLimited",
  suspended: "statusSuspended",
  unknown: "statusUnknown",
};

type ActiveSortKey = "limit" | "change" | "us" | "size";

const ACTIVE_SORTS: { key: ActiveSortKey; label: Key }[] = [
  { key: "limit", label: "sortLimit" },
  { key: "change", label: "sortChange" },
  { key: "us", label: "sortUs" },
  { key: "size", label: "sortSize" },
];

/** 限额金额本地化:中文 万元/元,英文 ¥ 千分位 */
function formatLimit(v: number | null, locale: Locale, t: T): string {
  if (v === null) return t("noCap");
  if (v === 0) return "—";
  if (locale === "en") return `¥${v.toLocaleString("en-US")}`;
  return v >= 10000
    ? `${(v / 10000).toLocaleString(locale, { maximumFractionDigits: 2 })} ${t("wanUnit")}`
    : `${v.toLocaleString(locale)} ${t("yuanUnit")}`;
}

const limitText = (status: FundStatus, v: number | null, locale: Locale, t: T) =>
  status === "suspended"
    ? t("statusSuspended")
    : status === "limited" && v === null
      ? t("limitNotDisclosed")
      : formatLimit(v, locale, t);

/** 规模(亿元):中文显示 亿,英文折算为 ¥B */
function formatSizeYi(n: number, locale: Locale, t: T): string {
  const v = n >= 100 ? Math.round(n) : n >= 10 ? +n.toFixed(1) : +n.toFixed(2);
  return locale === "en" ? `¥${(v / 10).toFixed(2)}B` : `${v} ${t("yiUnit")}`;
}

/** 服务端 note 是中文原文,客户端按 status+限额 重合成对应语言的提示 */
function fundNote(f: { status: FundStatus; limitYuan: number | null; note: string }, locale: Locale, t: T): string {
  switch (f.status) {
    case "suspended":
      return t("noteSuspended");
    case "open":
      return t("noteOpen");
    case "limited":
      return f.limitYuan != null ? t("noteLimit", { v: formatLimit(f.limitYuan, locale, t) }) : t("noteLimitNoAmount");
    default:
      return f.note === "抓取失败" ? t("noteFail") : t("noteUnknown");
  }
}

export default function FundList({ funds, activeFunds }: { funds: FundInfo[]; activeFunds: ActiveFundInfo[] }) {
  const { t, locale } = useI18n();
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
              <h3 className="font-medium text-fg">{t(label)}</h3>
              <span className="text-xs text-muted">{t("buyableCount", { n: rows.length })}</span>
            </div>
            {rows.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted">{t("noPurchasable")}</div>
            ) : (
              <div className="space-y-0.5">
                {rows.map((f) => (
                  <a
                    key={f.code}
                    href={`https://fund.eastmoney.com/${f.code}.html`}
                    target="_blank"
                    rel="noreferrer"
                    title={fundNote(f, locale, t)}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-chip/60"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-fg">{f.name}</div>
                      <div className="text-[11px] text-muted">{f.code}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums text-fg">
                        {limitText(f.status, f.limitYuan, locale, t)}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[f.status]}`}>
                        {t(STATUS_LABEL[f.status])}
                      </span>
                    </div>
                  </a>
                ))}
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
              <h3 className="font-medium text-fg">{t("activeCardTitle")}</h3>
              <div className="flex gap-1 rounded-lg bg-chip/80 p-0.5">
                {ACTIVE_SORTS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setActiveSort(s.key)}
                    className={`rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                      activeSort === s.key ? "bg-chip-active text-fg" : "text-muted hover:text-fg-soft"
                    }`}
                  >
                    {t(s.label)}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-1 text-xs text-muted">{t("activeSub", { n: buyableCount })}</div>
            <div className="space-y-0.5">
              {activeRows.map((f) => {
                const pct = f.dayChangePct;
                return (
                  <a
                    key={f.code}
                    href={`https://fund.eastmoney.com/${f.code}.html`}
                    target="_blank"
                    rel="noreferrer"
                    title={fundNote(f, locale, t)}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-chip/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-sm ${f.status === "suspended" ? "text-muted" : "text-fg"}`}>{f.name}</div>
                      <div className="text-[11px] text-muted">
                        {f.code}
                        {f.fundSizeYi != null && (
                          <span
                            title={t("sizeTooltip", {
                              size: formatSizeYi(f.fundSizeYi, locale, t),
                              date: f.sizeDate || t("latestPeriod"),
                            })}
                          >
                            {" · "}
                            {formatSizeYi(f.fundSizeYi, locale, t)}
                          </span>
                        )}
                        {f.region && (
                          <span
                            className="ml-1 text-muted"
                            title={t("regionTooltip", { date: f.holdingsDate || t("latest") })}
                          >
                            {(
                              [
                                ["regionUs", f.region.us],
                                ["regionHk", f.region.hk],
                                ["regionCn", f.region.cn],
                                ["regionOther", f.region.other],
                              ] as Array<[Key, number]>
                            )
                              .filter(([, v]) => v > 0)
                              .map(([k, v]) => ` · ${t(k)} ${v}%`)
                              .join("") || ` · ${t("regionUndisclosed")}`}
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
                        {limitText(f.status, f.limitYuan, locale, t)}
                      </span>
                      <span className={`hidden rounded px-1.5 py-0.5 text-[11px] font-medium sm:inline-block ${STATUS_STYLE[f.status]}`}>
                        {t(STATUS_LABEL[f.status])}
                      </span>
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
