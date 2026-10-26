import type { AssetKey } from "./market";

export type FundStatus = "open" | "limited" | "suspended" | "unknown";

/** 单只基金的申购状态与限额(主口径=天天基金代销渠道,与 QDII 额度雷达一致) */
export interface FundInfo {
  code: string;
  name: string;
  asset: AssetKey;
  status: FundStatus;
  /** 单日累计购买上限(元),null = 无上限/不适用 */
  limitYuan: number | null;
  note: string;
}

/** 美股方向主动 QDII(名称不含"纳斯达克",无法按关键词自动发现,手工核对;人民币份额) */
const ACTIVE_EXTRA: Pick<ActiveFundInfo, "code" | "name">[] = [
  { code: "000043", name: "嘉实美国成长股票人民币" },
  { code: "008253", name: "华宝致远混合(QDII)A" },
  { code: "008254", name: "华宝致远混合(QDII)C" },
  { code: "016701", name: "银华海外数字经济量化选股混合发起式(QDII)A" },
  { code: "016702", name: "银华海外数字经济量化选股混合发起式(QDII)C" },
  { code: "001668", name: "汇添富全球移动互联(QDII)" },
  { code: "270023", name: "广发全球精选股票(QDII)人民币A" },
  { code: "021277", name: "广发全球精选股票(QDII)人民币C" },
  { code: "486002", name: "工银全球精选股票(QDII)" },
  { code: "000041", name: "华夏全球股票(QDII)(人民币)" },
  { code: "005698", name: "华夏全球科技先锋混合(QDII)A(人民币)" },
  { code: "024239", name: "华夏全球科技先锋混合(QDII)C" },
  { code: "006373", name: "国富全球科技互联混合(QDII)人民币A" },
  { code: "021842", name: "国富全球科技互联混合(QDII)人民币C" },
  { code: "100055", name: "富国全球科技互联网股票(QDII)A" },
  { code: "022184", name: "富国全球科技互联网股票(QDII)C" },
  { code: "000988", name: "嘉实全球互联网股票人民币" },
  { code: "007455", name: "富国蓝筹精选股票(QDII)人民币" },
];

/** 纳斯达克主动/主题基金(名称含"纳斯达克"但非 100 指数:主动精选 + 科技/生物科技指数) */
export interface ActiveFundInfo {
  code: string;
  name: string;
  status: FundStatus;
  limitYuan: number | null;
  note: string;
  /** 最新单位净值日增长率(%),QDII 为 T-1 */
  dayChangePct: number | null;
  navDate: string;
  /** 全持仓区域分布(占净值比%,中报/年报口径),联接基金不披露为 null */
  region: { us: number; hk: number; cn: number; other: number } | null;
  holdingsDate: string;
  /** 最新期末净资产(亿元) */
  fundSizeYi: number | null;
  sizeDate: string;
}

/** 指数关键词 → 跟踪资产,改这里即可调整跟踪范围 */
const INDEX_RULES: { asset: AssetKey; kw: string }[] = [
  { asset: "ndx", kw: "纳斯达克100" },
  { asset: "spx", kw: "标普500" },
];

// 排除:美元份额(非人民币)、等权重(不同指数)、场内 ETF(只保留"ETF联接"场外份额)
const NAME_EXCLUDE = /美元|美钞|美汇|等权/;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

function formatYuan(numStr: string, wan: boolean): number {
  const n = parseFloat(numStr.replace(/,/g, ""));
  return wan ? n * 10000 : n;
}

/** 全量基金名单匹配:名称含指数关键词的场外人民币份额 */
async function fetchFundCodeTable(): Promise<string> {
  const res = await fetch("https://fund.eastmoney.com/js/fundcode_search.js", {
    headers: { "User-Agent": UA },
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`基金名单 HTTP ${res.status}`);
  return res.text();
}

/** 名称过滤:人民币份额、非场内 ETF(保留"ETF联接"场外份额) */
function keepFundName(name: string): boolean {
  if (NAME_EXCLUDE.test(name)) return false;
  return !(name.includes("ETF") && !name.includes("联接"));
}

async function discoverIndexFunds(): Promise<Pick<FundInfo, "code" | "name" | "asset">[]> {
  const js = await fetchFundCodeTable();
  const out: Pick<FundInfo, "code" | "name" | "asset">[] = [];
  const re = /\["(\d{6})","[^"]*","([^"]+)","[^"]*","[^"]*"\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(js))) {
    const name = m[2];
    if (!keepFundName(name)) continue;
    const rule = INDEX_RULES.find((r) => name.includes(r.kw));
    if (rule) out.push({ code: m[1], name, asset: rule.asset });
  }
  return out;
}

/** 纳斯达克主动/主题:名称含"纳斯达克"但不含"纳斯达克100" */
async function discoverNasdaqActiveFunds(): Promise<Pick<ActiveFundInfo, "code" | "name">[]> {
  const js = await fetchFundCodeTable();
  const out: Pick<ActiveFundInfo, "code" | "name">[] = [];
  const re = /\["(\d{6})","[^"]*","([^"]+)","[^"]*","[^"]*"\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(js))) {
    const name = m[2];
    if (!keepFundName(name)) continue;
    if (name.includes("纳斯达克") && !name.includes("纳斯达克100")) {
      out.push({ code: m[1], name });
    }
  }
  return out;
}

/** 最新单位净值与日增长率(东财 F10 历史净值,QDII 为 T-1);字段:FSRQ 日期 / JZZZL 日增长率 */
async function fetchNavChange(code: string): Promise<{ dayChangePct: number | null; navDate: string }> {
  return withRetry(async () => {
  const res = await fetch(
    `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${code}&pageIndex=1&pageSize=1`,
    {
      headers: { "User-Agent": UA, Referer: `https://fundf10.eastmoney.com/jjjz_${code}.html` },
      next: { revalidate: 3600 },
    }
  );
  if (!res.ok) throw new Error(`净值 HTTP ${res.status} (${code})`);
  const json = await res.json();
  const row = json?.Data?.LSJZList?.[0];
  const pct = row?.JZZZL ? parseFloat(row.JZZZL) : null;
  return {
    dayChangePct: pct !== null && !Number.isNaN(pct) ? pct : null,
    navDate: row?.FSRQ ?? "",
  };
  });
}

/** 爬天天基金费率页:申购状态表格优先于限额文本(暂停时页面仍会展示旧限额) */
async function fetchFundStatus(
  code: string
): Promise<Pick<FundInfo, "status" | "limitYuan" | "note">> {
  const url = `https://fundf10.eastmoney.com/jjfl_${code}.html`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`天天基金 HTTP ${res.status} (${code})`);
  const html = await res.text();

  const statusCell = html.match(/申购状态<\/td><td[^>]*>([^<]+)</)?.[1]?.trim();
  const limitMatch = html.match(/单日累计购买上限([\d,.]+)\s*(万)?元/);

  if (statusCell?.includes("暂停")) {
    return { status: "suspended", limitYuan: null, note: "天天基金显示暂停申购" };
  }
  if (limitMatch) {
    const yuan = formatYuan(limitMatch[1], Boolean(limitMatch[2]));
    return {
      status: "limited",
      limitYuan: yuan,
      note: `天天基金显示单日上限${limitMatch[1]}${limitMatch[2] ?? ""}元`,
    };
  }
  // 部分 I/D 类份额只标"限大额",页面未披露具体金额
  if (statusCell?.includes("限大额") || statusCell?.includes("限购")) {
    return { status: "limited", limitYuan: null, note: "天天基金显示限大额(未披露金额)" };
  }
  if (statusCell?.includes("开放")) {
    return { status: "open", limitYuan: null, note: "天天基金显示开放申购" };
  }
  return { status: "unknown", limitYuan: null, note: "天天基金状态未识别" };
}

/** 固定并发跑任务,避免一次性打满上游 */
async function mapLimit<T, R>(items: T[], fn: (t: T) => Promise<R>, concurrency = 8): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        results[idx] = { status: "fulfilled", value: await fn(items[idx]) };
      } catch (e) {
        results[idx] = { status: "rejected", reason: e };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

/** 发现 + 扫描全部跟踪基金(含暂停,入库/计数用;页面展示时再过滤开放+限额) */
export async function scanQdiiFunds(): Promise<FundInfo[]> {
  const candidates = await discoverIndexFunds();
  const settled = await mapLimit(candidates, (c) => fetchFundStatus(c.code));
  // 瞬时失败(网络抖动/上游限流)重试一次
  const retryIdx = settled.map((r, i) => (r.status === "rejected" ? i : -1)).filter((i) => i >= 0);
  for (const i of retryIdx) {
    try {
      settled[i] = { status: "fulfilled", value: await fetchFundStatus(candidates[i].code) };
    } catch {
      /* 重试仍失败,保持 rejected */
    }
  }
  return candidates.map((c, i) => {
    const r = settled[i];
    return r.status === "fulfilled"
      ? { ...c, ...r.value }
      : { ...c, status: "unknown" as const, limitYuan: null, note: "抓取失败" };
  });
}

/** 失败后退避重试(800ms/1600ms...),缓解上游瞬时限流 */
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 800 * i));
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/** 区域分布:中报/年报全持仓按市场前缀归类——美股(105/106/107)、港股(116)、A股(0/1)、其它 */
async function fetchRegionExposure(
  code: string
): Promise<{ region: { us: number; hk: number; cn: number; other: number } | null; holdingsDate: string }> {
  return withRetry(async () => {
  const res = await fetch(
    `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10&year=&month=6&_v=3`,
    {
      headers: { "User-Agent": UA, Referer: `https://fundf10.eastmoney.com/ccmx_${code}.html` },
      next: { revalidate: 86400 },
    }
  );
  if (!res.ok) throw new Error(`持仓 HTTP ${res.status} (${code})`);
  const text = await res.text();
  // month=6 返回中报全持仓(可能上千行),取第一张表
  const table = text.split("</table>")[0];
  const holdingsDate = table.match(/截止至：<font[^>]*>([\d-]+)</)?.[1] ?? "";
  const sums = { us: 0, hk: 0, cn: 0, other: 0 };
  let any = false;
  for (const row of table.split("<tr>")) {
    const mk = row.match(/unify\/r\/(\d+)\./);
    const pct = row.match(/>([\d.]+)%</);
    if (!mk || !pct) continue;
    any = true;
    const v = parseFloat(pct[1]);
    if (/^10[567]$/.test(mk[1])) sums.us += v;
    else if (mk[1] === "116") sums.hk += v;
    else if (mk[1] === "0" || mk[1] === "1") sums.cn += v;
    else sums.other += v;
  }
  if (!any) return { region: null, holdingsDate };
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return { region: { us: r1(sums.us), hk: r1(sums.hk), cn: r1(sums.cn), other: r1(sums.other) }, holdingsDate };
  });
}

/** 基金规模:规模变动表最新一期的期末净资产(亿元) */
async function fetchFundSize(code: string): Promise<{ fundSizeYi: number | null; sizeDate: string }> {
  return withRetry(async () => {
  const res = await fetch(
    `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=gmbd&mode=0&code=${code}`,
    {
      headers: { "User-Agent": UA, Referer: `https://fundf10.eastmoney.com/gmbd_${code}.html` },
      next: { revalidate: 86400 },
    }
  );
  if (!res.ok) throw new Error(`规模 HTTP ${res.status} (${code})`);
  const text = await res.text();
  // 最新一行:日期 + 期末净资产(第4个数值列)
  const row = text.match(/<tr><td>([\d-]+)<\/td>((?:<td[^>]*>[\d.%-]+<\/td>)+)<\/tr>/);
  if (!row) return { fundSizeYi: null, sizeDate: "" };
  const nums = row[2].match(/[\d.]+(?=<\/td>)/g) ?? [];
  return { fundSizeYi: nums[3] ? parseFloat(nums[3]) : null, sizeDate: row[1] };
  });
}

/** 扫描纳斯达克主题 + 美股方向主动 QDII:限购 + 当日涨跌幅 + 美股含量(全部状态,页面再按 开放+限额 过滤) */
export async function scanNasdaqActiveFunds(): Promise<ActiveFundInfo[]> {
  const nasdaq = await discoverNasdaqActiveFunds();
  const candidates = [...nasdaq, ...ACTIVE_EXTRA]; // 代码无重叠
  const settled = await mapLimit(
    candidates,
    (c) =>
      Promise.all([
        fetchFundStatus(c.code),
        fetchNavChange(c.code).catch(() => ({ dayChangePct: null, navDate: "" })),
        fetchRegionExposure(c.code).catch(() => ({ region: null, holdingsDate: "" })),
        fetchFundSize(c.code).catch(() => ({ fundSizeYi: null, sizeDate: "" })),
      ]),
    8
  );
  return candidates.map((c, i) => {
    const r = settled[i];
    if (r.status === "fulfilled") {
      const [status, nav, region, size] = r.value;
      return { ...c, ...status, ...nav, ...region, ...size };
    }
    return {
      ...c,
      status: "unknown" as const,
      limitYuan: null,
      note: "抓取失败",
      dayChangePct: null,
      navDate: "",
      region: null,
      holdingsDate: "",
      fundSizeYi: null,
      sizeDate: "",
    };
  });
}
