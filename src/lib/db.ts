import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export function getSql(): NeonQueryFunction<false, false> | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

let tableReady = false;

export async function ensureTable(sql: NeonQueryFunction<false, false>) {
  if (tableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS fund_limits (
      fund_code TEXT NOT NULL,
      date      TEXT NOT NULL,
      status    TEXT NOT NULL,
      limit_yuan NUMERIC,
      raw_text  TEXT,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (fund_code, date)
    )
  `;
  tableReady = true;
}

// 北京日期 YYYY-MM-DD
export function beijingDate(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date());
}
