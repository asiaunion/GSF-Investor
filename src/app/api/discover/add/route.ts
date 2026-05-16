import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/discover/add
 * 신규 종목 추가 + 체크리스트 자동 실행
 * Body: { ticker, yahooTicker, dartCorpCode?, secCik?, name, market, category?, broker?, thesis? }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    ticker,
    yahooTicker,
    dartCorpCode,
    secCik,
    name,
    market,
    category = "Core",
    broker,
    thesis,
  } = body;

  if (!ticker || !name || !market) {
    return NextResponse.json({ error: "ticker, name, market 필수" }, { status: 400 });
  }

  // 중복 확인
  const existing = await db.run(sql`
    SELECT id FROM stocks WHERE ticker = ${ticker}
  `);
  if (existing.rows.length) {
    return NextResponse.json({ error: `종목 ${ticker} 이미 존재합니다` }, { status: 409 });
  }

  // 종목 추가
  await db.run(sql`
    INSERT INTO stocks (ticker, yahoo_ticker, dart_corp_code, sec_cik, name, market, category, broker, thesis)
    VALUES (${ticker}, ${yahooTicker ?? null}, ${dartCorpCode ?? null}, ${secCik ?? null},
            ${name}, ${market}, ${category}, ${broker ?? null}, ${thesis ?? null})
  `);

  const stockRows = await db.run(sql`
    SELECT id FROM stocks WHERE ticker = ${ticker}
  `);
  const stockId = Number(stockRows.rows[0][0]);

  return NextResponse.json({ success: true, stockId, ticker });
}
