import type { AssetKey } from "./market";

/** 指数估值:当前 PE 与历史百分位(蛋卷指数估值,日更;黄金/ETF 不适用) */
export interface Valuation {
  pe: number | null;
  /** 历史百分位 0~1 */
  pePercentile: number | null;
  date: string;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

const INDEX_CODE: Partial<Record<AssetKey, string>> = {
  ndx: "NDX",
  spx: "SP500",
};

interface DanjuanItem {
  index_code: string;
  pe: number;
  pe_percentile?: number;
  date?: string;
}

export async function fetchValuations(): Promise<Partial<Record<AssetKey, Valuation>>> {
  const res = await fetch("https://danjuanfunds.com/djapi/index_eva/dj", {
    headers: { "User-Agent": UA },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`蛋卷估值 HTTP ${res.status}`);
  const json = await res.json();
  const items: DanjuanItem[] = json?.data?.items ?? [];

  const out: Partial<Record<AssetKey, Valuation>> = {};
  for (const [key, code] of Object.entries(INDEX_CODE) as [AssetKey, string][]) {
    const it = items.find((i) => i.index_code === code);
    if (it) {
      out[key] = {
        pe: it.pe || null,
        pePercentile: typeof it.pe_percentile === "number" ? it.pe_percentile : null,
        date: it.date ?? "",
      };
    }
  }
  return out;
}
