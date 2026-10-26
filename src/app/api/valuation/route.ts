import { NextResponse } from "next/server";
import { fetchValuations } from "@/lib/valuation";

export const dynamic = "force-dynamic";

// 纳指100 / 标普500 的当前 PE 与历史百分位(蛋卷,日更)
export async function GET() {
  try {
    const valuations = await fetchValuations();
    return NextResponse.json(valuations);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
