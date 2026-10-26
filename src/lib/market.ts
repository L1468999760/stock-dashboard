export type AssetKey = "ndx" | "spx" | "gold" | "dv50";

/** 金价来源:cn = 沪金主力,intl = 伦敦金现 */
export type GoldSource = "cn" | "intl";

export interface Quote {
  key: AssetKey;
  /** 仅 gold:标记国内/国际来源 */
  src?: GoldSource;
  name: string;
  unit: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  /** 仅盘中行情有,场外基金净值无高低价 */
  high?: number;
  low?: number;
  time: string;
}

export interface KLine {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
}

export const ASSETS: Record<AssetKey, { name: string; unit: string; precision: number }> = {
  ndx: { name: "纳斯达克100", unit: "点", precision: 2 },
  spx: { name: "标普500", unit: "点", precision: 2 },
  gold: { name: "伦敦金现", unit: "美元/盎司", precision: 2 },
  dv50: { name: "标普红利低波50", unit: "元", precision: 4 },
};

export const GOLD_SOURCES: Record<GoldSource, { name: string; unit: string }> = {
  cn: { name: "沪金主力", unit: "元/克" },
  intl: { name: "伦敦金现", unit: "美元/盎司" },
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

async function fetchGbk(url: string, revalidate: number, headers?: Record<string, string>) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, ...headers },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return new TextDecoder("gbk").decode(await res.arrayBuffer());
}

// 腾讯实时行情:usNDX / usINX
function parseTencentQuote(body: string, key: "ndx" | "spx"): Quote {
  const varName = key === "ndx" ? "v_usNDX" : "v_usINX";
  const m = body.match(new RegExp(`${varName}="([^"]*)"`));
  if (!m) throw new Error("腾讯行情解析失败");
  const f = m[1].split("~");
  const price = parseFloat(f[3]);
  const prevClose = parseFloat(f[4]);
  return {
    key,
    name: ASSETS[key].name,
    unit: ASSETS[key].unit,
    price,
    prevClose,
    change: price - prevClose,
    changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
    high: parseFloat(f[33]),
    low: parseFloat(f[34]),
    time: f[30],
  };
}

// 新浪贵金属实时:hf_XAU(伦敦金现)
function parseSinaGold(body: string): Quote {
  const m = body.match(/hq_str_hf_XAU="([^"]*)"/);
  if (!m) throw new Error("新浪黄金解析失败");
  const f = m[1].split(",");
  const price = parseFloat(f[0]);
  const prevClose = parseFloat(f[1]);
  return {
    key: "gold",
    src: "intl",
    name: GOLD_SOURCES.intl.name,
    unit: GOLD_SOURCES.intl.unit,
    price,
    prevClose,
    change: price - prevClose,
    changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
    high: parseFloat(f[4]),
    low: parseFloat(f[5]),
    time: `${f[12]} ${f[6]}`,
  };
}

// 腾讯ETF实时:sh515450(标普红利低波50ETF,008163 的场内母基金),只取估算所需的涨跌幅
interface EtfQuote {
  /** 行情日,YYYY-MM-DD */
  date: string;
  time: string;
  changePct: number;
  highPct: number;
  lowPct: number;
}

function parseTencentEtf(body: string): EtfQuote {
  const m = body.match(/v_sh515450="([^"]*)"/);
  if (!m) throw new Error("腾讯ETF解析失败");
  const f = m[1].split("~");
  const prevClose = parseFloat(f[4]);
  const pct = (p: number) => (prevClose ? ((p - prevClose) / prevClose) * 100 : 0);
  const t = f[30]; // yyyymmddHHMMSS
  return {
    date: `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`,
    time: `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)} ${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}`,
    changePct: pct(parseFloat(f[3])),
    highPct: pct(parseFloat(f[33])),
    lowPct: pct(parseFloat(f[34])),
  };
}

// 场外基金日净值:008163(南方标普红利低波50ETF联接A)
export interface FundNav {
  date: string;
  nav: number;
  /** 官方日涨跌幅(%),分红日按除息口径 */
  dailyPct: number;
}

// 取最新两日单位净值拼行情;母基金 ETF 场内已开新交易日而官方净值未出时,按场内涨跌估算当日净值
function parseFundQuote(nav: FundNav[], etf?: EtfQuote): Quote {
  const last = nav[nav.length - 1];
  const prev = nav[nav.length - 2];
  if (etf && etf.date > last.date) {
    const scale = (pct: number) => last.nav * (1 + pct / 100);
    return {
      key: "dv50",
      name: ASSETS.dv50.name,
      unit: ASSETS.dv50.unit,
      price: scale(etf.changePct),
      prevClose: last.nav,
      change: scale(etf.changePct) - last.nav,
      changePct: etf.changePct,
      high: scale(etf.highPct),
      low: scale(etf.lowPct),
      time: `${etf.time} 场内估算`,
    };
  }
  return {
    key: "dv50",
    name: ASSETS.dv50.name,
    unit: ASSETS.dv50.unit,
    price: last.nav,
    prevClose: prev.nav,
    change: last.nav - prev.nav,
    changePct: last.dailyPct,
    time: `${last.date} 净值`,
  };
}

// 新浪国内期货实时:nf_AU0(沪金主力)
function parseShfeGold(body: string): Quote {
  const m = body.match(/hq_str_nf_AU0="([^"]*)"/);
  if (!m) throw new Error("新浪沪金解析失败");
  const f = m[1].split(",");
  const price = parseFloat(f[8]);
  const prevClose = parseFloat(f[10]); // 昨结算价
  const t = f[1];
  return {
    key: "gold",
    src: "cn",
    name: GOLD_SOURCES.cn.name,
    unit: GOLD_SOURCES.cn.unit,
    price,
    prevClose,
    change: price - prevClose,
    changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
    high: parseFloat(f[3]),
    low: parseFloat(f[4]),
    time: `${f[17]} ${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`,
  };
}

export async function fetchRealtime(): Promise<Quote[]> {
  const [tencentBody, sinaBody, fundNav] = await Promise.all([
    fetchGbk("https://qt.gtimg.cn/q=usNDX,usINX,sh515450", 60),
    fetchGbk("https://hq.sinajs.cn/list=hf_XAU,nf_AU0", 60, {
      Referer: "https://finance.sina.com.cn",
    }),
    fetchFundNav().catch(() => null), // 净值源失败不拖垮美股/金价
  ]);
  const quotes = [
    parseTencentQuote(tencentBody, "ndx"),
    parseTencentQuote(tencentBody, "spx"),
  ];
  // 金价独立解析,单个失败不影响其他
  const sources: Array<{ body: string; parse: (b: string) => Quote }> = [
    { body: sinaBody, parse: parseSinaGold },
    { body: sinaBody, parse: parseShfeGold },
  ];
  for (const { body, parse } of sources) {
    try {
      quotes.push(parse(body));
    } catch {
      /* 跳过失败的来源 */
    }
  }
  // 场外基金净值(数据不足时跳过该卡片);场内 ETF 拉不到则退回官方净值
  if (fundNav && fundNav.length >= 2) {
    let etf: EtfQuote | undefined;
    try {
      etf = parseTencentEtf(tencentBody);
    } catch {
      /* 估算失败不掩盖官方净值 */
    }
    quotes.push(parseFundQuote(fundNav, etf));
  }
  return quotes;
}

const RANGE_BARS: Record<string, number> = { "3m": 63, "6m": 126, "1y": 250, "3y": 750 };

// MA250(年线)需要窗口前 250 根收盘价,额外多取一些作回看
const MA_LOOKBACK = 280;

/** 滚动简单均线,不足窗口的前段为 null */
export function computeMa(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(i >= window - 1 ? sum / window : null);
  }
  return out;
}

// 腾讯日K:开、收、高、低 顺序
async function fetchTencentKline(code: string, bars: number, fq = "qfq"): Promise<KLine[]> {
  const url = `https://proxy.finance.qq.com/ifzqgtimg/appstock/app/newfqkline/get?param=${code},day,,,${bars + MA_LOOKBACK},${fq}`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`腾讯K线 HTTP ${res.status}`);
  const json = await res.json();
  const rows: unknown[][] = json?.data?.[code]?.day ?? json?.data?.[code]?.qfqday ?? [];
  return rows.map((r) => ({
    date: String(r[0]),
    open: parseFloat(String(r[1])),
    close: parseFloat(String(r[2])),
    high: parseFloat(String(r[3])),
    low: parseFloat(String(r[4])),
  }));
}

// 天天基金场外净值:008163(南方标普红利低波50ETF联接A)单位净值全量,实时与历史共用一份缓存
async function fetchFundNav(): Promise<FundNav[]> {
  const res = await fetch("https://fund.eastmoney.com/pingzhongdata/008163.js", {
    headers: { "User-Agent": UA, Referer: "https://fund.eastmoney.com/008163.html" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`天天基金净值 HTTP ${res.status}`);
  const body = await res.text();
  const m = body.match(/var Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) throw new Error("天天基金净值解析失败");
  const rows = JSON.parse(m[1]) as Array<{ x: number; y: number; equityReturn: number }>;
  return rows.map((r) => {
    // x 为净值日北京时间 0 点,补 8 小时再取 UTC 日期,避免差一天
    const d = new Date(r.x + 8 * 3600 * 1000);
    return { date: d.toISOString().slice(0, 10), nav: r.y, dailyPct: r.equityReturn };
  });
}

// 场外基金日K:只有日频净值,开高低填同值(单位净值不复权,含分红除息跳变)
async function fetchFundKline(bars: number): Promise<KLine[]> {
  const nav = await fetchFundNav();
  return nav.slice(-(bars + MA_LOOKBACK)).map((p) => ({
    date: p.date,
    open: p.nav,
    close: p.nav,
    high: p.nav,
    low: p.nav,
  }));
}

// 新浪全球期货 XAU 日K(全量,截取尾部)
async function fetchSinaGoldKline(bars: number): Promise<KLine[]> {
  const url =
    "https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20t=/GlobalFuturesService.getGlobalFuturesDailyKLine?symbol=XAU";
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Referer: "https://finance.sina.com.cn" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`新浪黄金K线 HTTP ${res.status}`);
  const text = await res.text();
  const start = text.indexOf("(");
  const end = text.lastIndexOf(")");
  const arr = JSON.parse(text.slice(start + 1, end)) as Array<{
    date: string;
    open: string;
    high: string;
    low: string;
    close: string;
  }>;
  return arr.slice(-(bars + MA_LOOKBACK)).map((r) => ({
    date: r.date,
    open: parseFloat(r.open),
    close: parseFloat(r.close),
    high: parseFloat(r.high),
    low: parseFloat(r.low),
  }));
}

// 新浪国内期货日K(全量,截取尾部),字段为 d/o/h/l/c
async function fetchSinaInnerKline(symbol: string, bars: number): Promise<KLine[]> {
  const url = `https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20t=/InnerFuturesNewService.getDailyKLine?symbol=${symbol}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Referer: "https://finance.sina.com.cn" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`新浪沪金K线 HTTP ${res.status}`);
  const text = await res.text();
  const start = text.indexOf("(");
  const end = text.lastIndexOf(")");
  const arr = JSON.parse(text.slice(start + 1, end)) as Array<{
    d: string;
    o: string;
    h: string;
    l: string;
    c: string;
  }>;
  return arr.slice(-(bars + MA_LOOKBACK)).map((r) => ({
    date: r.d,
    open: parseFloat(r.o),
    close: parseFloat(r.c),
    high: parseFloat(r.h),
    low: parseFloat(r.l),
  }));
}

export interface HistoryResult {
  lines: KLine[];
  /** 250日均线(年线),与 lines 对齐,前段不足窗口为 null */
  ma250: (number | null)[];
  /** 20日均线(月线),与 lines 对齐 */
  ma20: (number | null)[];
  /** 仅 dv50:股息率(%),与 lines 对齐;= 当前股息率 × 当前PE/当日PE 估算(官方无历史股息率) */
  dy?: (number | null)[];
  /** 仅 dv50:股债利差(%) = 股息率 − 中国10年期国债收益率 */
  spread?: (number | null)[];
  /** 仅 gold:美元指数(DINIW 收盘,右轴),与 lines 对齐 */
  dxy?: (number | null)[];
  /** 仅 gold:美国CPI同比(%),按发布日对齐,与 lines 对齐 */
  cpi?: (number | null)[];
}

// 中证红利低波(H30269,标普红利低波50的近似同族指数)官方日频 PE 历史,2013 年至今
async function fetchCsiPeHistory(): Promise<{ date: string; pe: number }[]> {
  const res = await fetch(
    "https://www.csindex.com.cn/csindex-home/perf/indexCsiDsPe?indexCode=H30269",
    { headers: { "User-Agent": UA, Referer: "https://www.csindex.com.cn/" }, next: { revalidate: 43200 } }
  );
  if (!res.ok) throw new Error(`中证指数PE HTTP ${res.status}`);
  const json = await res.json();
  const rows: { tradeDate: string; peg: number }[] = json?.data ?? [];
  return rows
    .map((r) => {
      const s = String(r.tradeDate).replace(/-/g, "");
      return { date: `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`, pe: parseFloat(String(r.peg)) };
    })
    .filter((p) => Number.isFinite(p.pe));
}

// 中国10年期国债收益率(%):东财数据中心,每页最多 500 行,取两页覆盖 3 年+
async function fetchTreasury10y(): Promise<Map<string, number>> {
  const base =
    "https://datacenter.eastmoney.com/api/data/get?type=RPTA_WEB_TREASURYYIELD&sty=ALL&st=SOLAR_DATE&sr=-1&token=894050c76af8597a853f5b408b759f5d";
  const pages = await Promise.all(
    [1, 2].map(async (p) => {
      const res = await fetch(`${base}&p=${p}&ps=500&pageNo=${p}`, {
        headers: { "User-Agent": UA },
        next: { revalidate: 43200 },
      });
      if (!res.ok) throw new Error(`国债收益率 HTTP ${res.status}`);
      const json = await res.json();
      return (json?.result?.data ?? []) as { SOLAR_DATE: string; EMM00166466: number | null }[];
    })
  );
  const map = new Map<string, number>();
  for (const row of pages.flat()) {
    const d = row.SOLAR_DATE?.slice(0, 10);
    if (d && row.EMM00166466 != null) map.set(d, row.EMM00166466);
  }
  return map;
}

// 新浪外汇日K(全量):DINIW=美元指数,格式为 "日期,开,低,高,收,|…" 的管道串,只取收盘
async function fetchDxyCloses(): Promise<Map<string, number>> {
  const url =
    "https://vip.stock.finance.sina.com.cn/forex/api/jsonp.php/var%20fx=/NewForexService.getDayKLine?symbol=DINIW";
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Referer: "https://finance.sina.com.cn" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`新浪美元指数K线 HTTP ${res.status}`);
  const text = await res.text();
  const start = text.indexOf("(");
  const end = text.lastIndexOf(")");
  const body = JSON.parse(text.slice(start + 1, end)) as string;
  const map = new Map<string, number>();
  for (const row of body.split("|")) {
    const f = row.split(",");
    const close = parseFloat(f[4]);
    if (f[0] && Number.isFinite(close)) map.set(f[0], close);
  }
  return map;
}

// 美国CPI同比(%):东财数据中心 EMG00000733(消费者物价指数年率),一页 500 行覆盖全量
async function fetchUsCpiYoY(): Promise<Map<string, number>> {
  const url =
    "https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_ECONOMICVALUE_USA&columns=ALL&filter=(INDICATOR_ID%3D%22EMG00000733%22)&pageNumber=1&pageSize=500&sortColumns=REPORT_DATE&sortTypes=-1&source=WEB";
  const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 43200 } });
  if (!res.ok) throw new Error(`美国CPI HTTP ${res.status}`);
  const json = await res.json();
  const rows: { PUBLISH_DATE: string; VALUE: number | null }[] = json?.result?.data ?? [];
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = r.PUBLISH_DATE?.slice(0, 10);
    if (d && r.VALUE != null) map.set(d, r.VALUE);
  }
  return map;
}

// 逐日对齐到展示窗口:取"当日及之前最近一次"的值(发布日/交易日跨周末、节假日也能命中)
function alignByDate(shown: KLine[], map: Map<string, number>): (number | null)[] {
  const events = Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
  const out: (number | null)[] = [];
  let i = 0;
  let last: number | null = null;
  for (const l of shown) {
    while (i < events.length && events[i][0] <= l.date) {
      last = events[i][1];
      i++;
    }
    out.push(last);
  }
  return out;
}

// 蛋卷"红利低波"当前股息率(小数,如 0.0478);URL 与 valuation.ts 相同,共享 Next 缓存
async function fetchDanjuanDividendYield(): Promise<number | null> {
  const res = await fetch("https://danjuanfunds.com/djapi/index_eva/dj", {
    headers: { "User-Agent": UA },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`蛋卷估值 HTTP ${res.status}`);
  const json = await res.json();
  const item = (json?.data?.items ?? []).find((i: { index_code?: string }) => i.index_code === "CSIH30269");
  const y = parseFloat(item?.yeild);
  return Number.isFinite(y) ? y : null;
}

// 股息率序列:官方无历史股息率,按 当前股息率×当日PE反比 估算(假设分红比例稳定),并与10年国债求利差
async function computeDv50Yield(
  shown: KLine[]
): Promise<{ dy: (number | null)[]; spread: (number | null)[] } | null> {
  const [peHist, t10y, dy0] = await Promise.all([fetchCsiPeHistory(), fetchTreasury10y(), fetchDanjuanDividendYield()]);
  if (dy0 == null || peHist.length < 2) return null;
  const peMap = new Map(peHist.map((p) => [p.date, p.pe]));
  const peNow = peHist[peHist.length - 1].pe;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const dy: (number | null)[] = [];
  const spread: (number | null)[] = [];
  let lastPe: number | null = null;
  let lastT: number | null = null;
  for (const l of shown) {
    lastPe = peMap.get(l.date) ?? lastPe;
    lastT = t10y.get(l.date) ?? lastT;
    if (lastPe == null) {
      dy.push(null);
      spread.push(null);
      continue;
    }
    const d = r2(dy0 * (peNow / lastPe) * 100);
    dy.push(d);
    spread.push(lastT != null ? r2(d - lastT) : null);
  }
  return { dy, spread };
}

export async function fetchHistory(key: AssetKey, range: string, src: GoldSource = "cn"): Promise<HistoryResult> {
  const bars = RANGE_BARS[range] ?? 250;
  let lines: KLine[];
  if (key === "gold") {
    lines = src === "cn" ? await fetchSinaInnerKline("AU0", bars) : await fetchSinaGoldKline(bars);
  } else if (key === "dv50") {
    lines = await fetchFundKline(bars);
  } else {
    lines = await fetchTencentKline(key === "ndx" ? "usNDX" : "usINX", bars);
  }
  // 先在含回看的全量序列上算均线,再截取展示窗口,保证窗口起点就有均线值
  const shown = lines.slice(-bars);
  const closes = lines.map((l) => l.close);
  const result: HistoryResult = {
    lines: shown,
    ma250: computeMa(closes, 250).slice(-bars),
    ma20: computeMa(closes, 20).slice(-bars),
  };
  if (key === "dv50") {
    // 股息率/利差为可选增强,失败不影响主图
    const extra = await computeDv50Yield(shown).catch(() => null);
    if (extra) {
      result.dy = extra.dy;
      result.spread = extra.spread;
    }
  }
  if (key === "gold") {
    // 美元指数/CPI为可选增强,各自独立容错
    const [dxyMap, cpiMap] = await Promise.all([
      fetchDxyCloses().catch(() => null),
      fetchUsCpiYoY().catch(() => null),
    ]);
    if (dxyMap) result.dxy = alignByDate(shown, dxyMap);
    if (cpiMap) result.cpi = alignByDate(shown, cpiMap);
  }
  return result;
}
