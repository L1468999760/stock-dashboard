import { NextRequest, NextResponse } from "next/server";
import { fetchHistory, type AssetKey, type GoldSource } from "@/lib/market";

const VALID_KEYS: AssetKey[] = ["ndx", "spx", "gold", "dv50"];
const VALID_RANGES = ["3m", "6m", "1y", "3y"];
const VALID_SRCS: GoldSource[] = ["cn", "intl"];

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") as AssetKey | null;
  const range = request.nextUrl.searchParams.get("range") ?? "1y";
  const src = (request.nextUrl.searchParams.get("src") ?? "cn") as GoldSource;

  if (!symbol || !VALID_KEYS.includes(symbol)) {
    return NextResponse.json({ error: "symbol 必须是 ndx / spx / gold / dv50" }, { status: 400 });
  }
  if (!VALID_RANGES.includes(range)) {
    return NextResponse.json({ error: "range 必须是 3m / 6m / 1y / 3y" }, { status: 400 });
  }
  if (!VALID_SRCS.includes(src)) {
    return NextResponse.json({ error: "src 必须是 cn / intl" }, { status: 400 });
  }

  try {
    const { lines, ma250, ma20, dy, spread, dxy, cpi } = await fetchHistory(symbol, range, src);
    return NextResponse.json({
      symbol,
      range,
      src,
      lines,
      ma250,
      ma20,
      dy: dy ?? null,
      spread: spread ?? null,
      dxy: dxy ?? null,
      cpi: cpi ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `历史数据拉取失败: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
