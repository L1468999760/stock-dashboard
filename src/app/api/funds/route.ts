import { NextResponse } from "next/server";
import { scanQdiiFunds, scanNasdaqActiveFunds } from "@/lib/funds";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 指数组(开放+限额过滤展示)+ 纳斯达克主动/主题组(限额+当日涨跌幅)
export async function GET() {
  try {
    const [funds, active] = await Promise.all([scanQdiiFunds(), scanNasdaqActiveFunds()]);
    return NextResponse.json({ updatedAt: new Date().toISOString(), funds, active });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
