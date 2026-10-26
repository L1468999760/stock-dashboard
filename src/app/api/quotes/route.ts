import { NextResponse } from "next/server";
import { fetchRealtime } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const quotes = await fetchRealtime();
    return NextResponse.json({ quotes, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { error: `行情拉取失败: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
