import { NextRequest, NextResponse } from "next/server";
import { scanQdiiFunds, scanNasdaqActiveFunds } from "@/lib/funds";
import { beijingDate, ensureTable, getSql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const [funds, active] = await Promise.all([scanQdiiFunds(), scanNasdaqActiveFunds()]);
  const sql = getSql();
  if (!sql) {
    return NextResponse.json({ ok: true, saved: false, reason: "未配置 DATABASE_URL,仅拉取未入库", count: funds.length });
  }

  await ensureTable(sql);
  const date = beijingDate();
  // 指数组 + 纳斯达克主动/主题组 一起入库
  const rows = [
    ...funds.map((f) => ({ code: f.code, status: f.status, limitYuan: f.limitYuan, name: f.name, note: f.note })),
    ...active.map((f) => ({ code: f.code, status: f.status, limitYuan: f.limitYuan, name: f.name, note: f.note })),
  ];
  const results = await Promise.allSettled(
    rows.map(async (f) => {
      await sql`
        INSERT INTO fund_limits (fund_code, date, status, limit_yuan, raw_text)
        VALUES (${f.code}, ${date}, ${f.status}, ${f.limitYuan}, ${`${f.name} ${f.note}`})
        ON CONFLICT (fund_code, date)
        DO UPDATE SET status = EXCLUDED.status, limit_yuan = EXCLUDED.limit_yuan,
                      raw_text = EXCLUDED.raw_text, fetched_at = now()
      `;
      return f.code;
    })
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  return NextResponse.json({ ok: failed === 0, date, count: rows.length - failed, failed });
}
