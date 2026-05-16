import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports
 * 보고서 목록 조회 (최신 50건)
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.run(sql`
    SELECT
      r.id,
      r.stock_id,
      s.ticker,
      s.name AS stock_name,
      r.trigger,
      r.generated_at,
      SUBSTR(r.content_md, 1, 200) AS preview
    FROM reports r
    JOIN stocks s ON s.id = r.stock_id
    ORDER BY r.generated_at DESC
    LIMIT 50
  `);

  const reports = rows.rows.map((r) => ({
    id: Number(r[0]),
    stockId: Number(r[1]),
    ticker: String(r[2]),
    stockName: String(r[3]),
    trigger: String(r[4]),
    generatedAt: String(r[5]),
    preview: String(r[6]),
  }));

  return NextResponse.json({ reports });
}
