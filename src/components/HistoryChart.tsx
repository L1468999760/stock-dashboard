"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { AssetKey, GoldSource } from "@/lib/market";
import { assetLabel } from "@/lib/i18n";
import type { Valuation } from "@/lib/valuation";
import GoldToggle from "./GoldToggle";
import { useI18n } from "./I18nProvider";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-xl bg-card" />,
});

interface KLine {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
}

interface HistoryData {
  lines: KLine[];
  ma250: (number | null)[];
  ma20: (number | null)[];
  /** 仅 dv50:股息率(%) / 股债利差(%),与 lines 对齐 */
  dy?: (number | null)[] | null;
  spread?: (number | null)[] | null;
  /** 仅 gold:美元指数 / 美国CPI同比(%),与 lines 对齐 */
  dxy?: (number | null)[] | null;
  cpi?: (number | null)[] | null;
}

const LINE_COLOR: Record<AssetKey, string> = {
  ndx: "#a78bfa",
  spx: "#60a5fa",
  gold: "#fbbf24",
  dv50: "#34d399",
};

const MA_COLOR = "#fb923c"; // 年线(橙色虚线)
const MA20_COLOR = "#38bdf8"; // 月线(天蓝细线,默认隐藏)
const DY_COLOR = "#f472b6"; // 股息率(粉,右轴,默认隐藏)
const SPREAD_COLOR = "#a78bfa"; // 股债利差(紫虚线,右轴,默认隐藏)
const DXY_COLOR = "#2dd4bf"; // 美元指数(青,右轴,默认隐藏)
const CPI_COLOR = "#f472b6"; // 美国CPI同比(粉虚线,右轴,默认隐藏)

interface Props {
  asset: AssetKey;
  range: string;
  goldSrc?: GoldSource;
  onGoldSrcChange?: (src: GoldSource) => void;
  valuation?: Valuation;
  /** 暗色主题(坐标轴/提示框配色),默认暗色 */
  dark?: boolean;
}

export default function HistoryChart({ asset, range, goldSrc, onGoldSrcChange, valuation, dark = true }: Props) {
  const { t } = useI18n();
  // 图例/系列的本地化名称(ECharts 画布不吃 CSS,字符串需随语言重建)
  const S = {
    close: t("seriesClose"),
    ma250: t("seriesMa250"),
    ma20: t("seriesMa20"),
    dy: t("seriesDy"),
    spread: t("seriesSpread"),
    dxy: t("seriesDxy"),
    cpi: t("seriesCpi"),
  };
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    const qs = new URLSearchParams({ symbol: asset, range });
    if (asset === "gold" && goldSrc) qs.set("src", goldSrc);
    fetch(`/api/history?${qs}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.error) setError(j.error);
        else setData({ lines: j.lines, ma250: j.ma250, ma20: j.ma20, dy: j.dy, spread: j.spread, dxy: j.dxy, cpi: j.cpi });
      })
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [asset, range, goldSrc]);

  const goldKey = assetLabel("gold", goldSrc ?? "cn");
  const metaName = asset === "gold" ? t(goldKey.name) : t(assetLabel(asset).name);
  const color = LINE_COLOR[asset];
  const precision = asset === "dv50" ? 4 : 2;
  const lines = data?.lines ?? [];
  const ma250 = data?.ma250 ?? [];
  const ma20 = data?.ma20 ?? [];
  const dy = data?.dy ?? [];
  const spread = data?.spread ?? [];
  const dxy = data?.dxy ?? [];
  const cpi = data?.cpi ?? [];
  const hasYield = asset === "dv50" && dy.some((v) => v != null);
  const hasDxy = asset === "gold" && dxy.some((v) => v != null);
  const hasCpi = asset === "gold" && cpi.some((v) => v != null);

  // ECharts 里的坐标轴/提示框随主题取色(画布不吃 CSS 变量)
  const ui = dark
    ? { legend: "#a1a1aa", axisLabel: "#71717a", axisLine: "#3f3f46", split: "#27272a", tipBg: "#18181b", tipBorder: "#3f3f46", tipText: "#e4e4e7" }
    : { legend: "#52525b", axisLabel: "#71717a", axisLine: "#d4d4d8", split: "#e4e4e7", tipBg: "#ffffff", tipBorder: "#d4d4d8", tipText: "#27272a" };

  const priceAxis = {
    type: "value" as const,
    scale: true,
    axisLabel: { color: ui.axisLabel, fontSize: 11 },
    splitLine: { lineStyle: { color: ui.split } },
  };
  // 股息率/利差的百分比右轴
  const pctAxis = {
    type: "value" as const,
    scale: true,
    axisLabel: { color: ui.axisLabel, fontSize: 11, formatter: "{value}%" },
    splitLine: { show: false },
  };
  // 美元指数右轴(数值)与 CPI 同比右轴(%),两条同侧时用 offset 错开刻度
  const dxyAxis = {
    type: "value" as const,
    scale: true,
    position: "right" as const,
    axisLabel: { color: ui.axisLabel, fontSize: 11 },
    splitLine: { show: false },
  };
  const cpiAxis = {
    type: "value" as const,
    scale: true,
    position: "right" as const,
    offset: hasDxy ? 36 : 0,
    axisLabel: { color: ui.axisLabel, fontSize: 11, formatter: "{value}%" },
    splitLine: { show: false },
  };
  // 右轴下标:1=美元指数,2=CPI(无美元指数时 CPI 占 1)
  const dxyAxisIdx = 1;
  const cpiAxisIdx = hasDxy ? 2 : 1;

  const option = {
    backgroundColor: "transparent",
    grid: {
      left: 56,
      right: hasYield ? 44 : hasDxy && hasCpi ? 88 : hasDxy || hasCpi ? 44 : 16,
      top: 36,
      bottom: 40,
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: ui.legend, fontSize: 11 },
      // 月线/股息率/股债利差/美元指数/CPI默认不展示,点击图例切换
      selected: {
        [S.close]: true,
        [S.ma250]: true,
        [S.ma20]: false,
        ...(hasYield ? { [S.dy]: false, [S.spread]: false } : {}),
        ...(hasDxy ? { [S.dxy]: false } : {}),
        ...(hasCpi ? { [S.cpi]: false } : {}),
      } as Record<string, boolean>,
    },
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: ui.tipBg,
      borderColor: ui.tipBorder,
      textStyle: { color: ui.tipText, fontSize: 12 },
      formatter: (params: unknown) => {
        const arr = Array.isArray(params) ? params : [params];
        const head = (arr[0] as { name: string })?.name ?? "";
        const idx = lines.findIndex((l) => l.date === head);
        const close = lines[idx]?.close;
        const ma250v = ma250[idx];
        const ma20v = ma20[idx];
        const dyv = dy[idx];
        const spv = spread[idx];
        const dxyv = dxy[idx];
        const cpiv = cpi[idx];
        let html = head;
        if (close !== undefined) html += `<br/>${t("tipClose")} <b>${close.toFixed(precision)}</b>`;
        if (ma20v != null) html += `<br/>${t("tipMa20")} <b>${ma20v.toFixed(precision)}</b>`;
        if (ma250v != null) html += `<br/>${t("tipMa250")} <b>${ma250v.toFixed(precision)}</b>`;
        if (dyv != null) html += `<br/>${S.dy} <b>${dyv.toFixed(2)}%</b>`;
        if (spv != null) html += `<br/>${S.spread} <b>${spv.toFixed(2)}%</b>`;
        if (dxyv != null) html += `<br/>${t("tipDxy")} <b>${dxyv.toFixed(2)}</b>`;
        if (cpiv != null) html += `<br/>${t("tipCpi")} <b>${cpiv.toFixed(1)}%</b>`;
        return html;
      },
    },
    xAxis: {
      type: "category" as const,
      data: lines.map((l) => l.date),
      axisLine: { lineStyle: { color: ui.axisLine } },
      axisLabel: { color: ui.axisLabel, fontSize: 11 },
      boundaryGap: false,
    },
    yAxis: hasYield
      ? [priceAxis, pctAxis]
      : hasDxy || hasCpi
        ? [priceAxis, ...(hasDxy ? [dxyAxis] : []), ...(hasCpi ? [cpiAxis] : [])]
        : priceAxis,
    dataZoom: [{ type: "inside" as const }],
    series: [
      {
        name: S.close,
        type: "line" as const,
        data: lines.map((l) => l.close),
        showSymbol: false,
        lineStyle: { color, width: 1.6 },
        itemStyle: { color },
        areaStyle: {
          color: {
            type: "linear" as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${color}55` },
              { offset: 1, color: `${color}00` },
            ],
          },
        },
      },
      ...(hasDxy
        ? [
            {
              name: S.dxy,
              type: "line" as const,
              yAxisIndex: dxyAxisIdx,
              data: dxy,
              showSymbol: false,
              lineStyle: { color: DXY_COLOR, width: 1.4 },
              itemStyle: { color: DXY_COLOR },
            },
          ]
        : []),
      {
        name: S.ma250,
        type: "line" as const,
        data: ma250,
        showSymbol: false,
        lineStyle: { color: MA_COLOR, width: 1.2, type: "dashed" as const },
        itemStyle: { color: MA_COLOR },
      },
      {
        name: S.ma20,
        type: "line" as const,
        data: ma20,
        showSymbol: false,
        lineStyle: { color: MA20_COLOR, width: 1 },
        itemStyle: { color: MA20_COLOR },
      },
      ...(hasCpi
        ? [
            {
              name: S.cpi,
              type: "line" as const,
              yAxisIndex: cpiAxisIdx,
              data: cpi,
              showSymbol: false,
              lineStyle: { color: CPI_COLOR, width: 1.2, type: "dashed" as const },
              itemStyle: { color: CPI_COLOR },
            },
          ]
        : []),
      ...(hasYield
        ? [
            {
              name: S.dy,
              type: "line" as const,
              yAxisIndex: 1,
              data: dy,
              showSymbol: false,
              lineStyle: { color: DY_COLOR, width: 1.4 },
              itemStyle: { color: DY_COLOR },
            },
            {
              name: S.spread,
              type: "line" as const,
              yAxisIndex: 1,
              data: spread,
              showSymbol: false,
              lineStyle: { color: SPREAD_COLOR, width: 1.2, type: "dashed" as const },
              itemStyle: { color: SPREAD_COLOR },
            },
          ]
        : []),
    ],
  };

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-1">
        <h3 className="font-medium text-fg">{t("trendTitle", { name: metaName })}</h3>
        <div className="flex items-center gap-2">
          {valuation?.pe != null && (
            <span
              className="rounded bg-chip px-1.5 py-0.5 text-[11px] text-fg-soft"
              title={t("peTooltip", { date: valuation.date || t("peDateFallback") })}
            >
              PE <b className="tabular-nums">{valuation.pe.toFixed(2)}</b>
              {valuation.pePercentile != null && (
                <span className="text-muted"> · {t("pePercentile", { n: (valuation.pePercentile * 100).toFixed(0) })}</span>
              )}
            </span>
          )}
          {asset === "gold" && goldSrc && onGoldSrcChange && (
            <GoldToggle value={goldSrc} onChange={onGoldSrcChange} />
          )}
          {lines.length > 0 && (
            <span className="text-xs text-muted">
              {lines[0].date} ~ {lines[lines.length - 1].date}
            </span>
          )}
        </div>
      </div>
      {error ? (
        <div className="flex h-80 items-center justify-center text-sm text-up">{error}</div>
      ) : lines.length === 0 ? (
        <div className="h-80 animate-pulse rounded-lg bg-chip/50" />
      ) : (
        <ReactECharts option={option} style={{ height: 320 }} notMerge />
      )}
    </div>
  );
}
