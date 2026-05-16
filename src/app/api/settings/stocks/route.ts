import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/stocks — 관심종목 전체 (is_active 포함 모두)
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.run(sql`
    SELECT id, ticker, name, market, category, broker, thesis,
           yahoo_ticker, dart_corp_code, sec_cik, is_active, added_at
    FROM stocks
    ORDER BY is_active DESC, category, ticker
  `);

  const stocks = rows.rows.map((r) => ({
    id: Number(r[0]),
    ticker: String(r[1]),
    name: String(r[2]),
    market: String(r[3]),
    category: String(r[4]),
    broker: r[5] ? String(r[5]) : "",
    thesis: r[6] ? String(r[6]) : "",
    yahooTicker: r[7] ? String(r[7]) : "",
    dartCorpCode: r[8] ? String(r[8]) : "",
    secCik: r[9] ? String(r[9]) : "",
    isActive: Number(r[10]),
    addedAt: String(r[11]),
  }));

  return NextResponse.json({ stocks });
}

/**
 * PATCH /api/settings/stocks — 종목 정보 업데이트 또는 활성/비활성 토글
 * body: { id, field, value } or { id, isActive }
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, field, value, isActive } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // 활성/비활성 토글
  if (isActive !== undefined) {
    await db.run(sql`UPDATE stocks SET is_active = ${isActive ? 1 : 0} WHERE id = ${id}`);
    return NextResponse.json({ success: true });
  }

  // 다중 필드 업데이트
  if (body.updates && typeof body.updates === "object") {
    const allowed = ["broker", "thesis", "category", "yahoo_ticker", "dart_corp_code", "sec_cik"];
    for (const [key, val] of Object.entries(body.updates)) {
      if (allowed.includes(key)) {
        await db.run(sql`UPDATE stocks SET ${sql.raw(key)} = ${val} WHERE id = ${id}`);
      }
    }
    return NextResponse.json({ success: true });
  }

  // 개별 필드 업데이트 (기존 방식 유지)
  const allowed = ["broker", "thesis", "category", "yahoo_ticker", "dart_corp_code", "sec_cik"];
  const col = field as string;
  if (!allowed.includes(col)) {
    return NextResponse.json({ error: "허용되지 않은 필드" }, { status: 400 });
  }

  await db.run(sql`UPDATE stocks SET ${sql.raw(col)} = ${value} WHERE id = ${id}`);
  return NextResponse.json({ success: true });
}
