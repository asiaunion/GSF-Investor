import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { toObjs, toObj } from "@/lib/db-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 관심종목 전체 + 최신 주가
  const stocksRows = await db.run(sql`
    SELECT
      s.id,
      s.ticker,
      s.name,
      s.market,
      s.category,
      s.broker,
      s.thesis,
      s.is_active,
      p.close_price,
      p.date AS price_date,
      p.currency
    FROM stocks s
    LEFT JOIN (
      SELECT p1.stock_id, p1.close_price, p1.date, p1.currency
      FROM prices p1
      INNER JOIN (
        SELECT stock_id, MAX(date) AS max_date FROM prices GROUP BY stock_id
      ) latest ON p1.stock_id = latest.stock_id AND p1.date = latest.max_date
    ) p ON s.id = p.stock_id
    WHERE s.is_active = 1
    ORDER BY s.category, s.ticker
  `);

  // v_portfolio — 현재 보유 수량·평균단가 (stock_id 직접 사용)
  const portfolioRows = await db.run(sql`
    SELECT stock_id, quantity, avg_price FROM v_portfolio
  `);

  const fxRow = await db.run(sql`
    SELECT rate FROM exchange_rates WHERE pair = 'USDKRW' ORDER BY date DESC LIMIT 1
  `);
  if (!fxRow.rows.length) {
    return NextResponse.json({ error: "환율 데이터 없음 — daily_price.py를 먼저 실행하세요" }, { status: 500 });
  }
  const usdkrw = Number(toObj(fxRow as unknown as import("@/lib/db-utils").RawResult).rate);

  const portfolioMap = new Map<number, { quantity: number; avgPrice: number }>();
  for (const r of toObjs(portfolioRows as unknown as import("@/lib/db-utils").RawResult)) {
    portfolioMap.set(Number(r.stock_id), {
      quantity: Number(r.quantity),
      avgPrice: Number(r.avg_price),
    });
  }

  const stocks = toObjs(stocksRows as unknown as import("@/lib/db-utils").RawResult).map((row) => {
    const id = Number(row.id);
    const ticker = String(row.ticker);
    const name = String(row.name);
    const market = String(row.market);
    const category = String(row.category);
    const broker = row.broker ? String(row.broker) : null;
    const thesis = row.thesis ? String(row.thesis) : null;
    const isActive = Number(row.is_active);
    const currentPrice = row.close_price != null ? Number(row.close_price) : null;
    const priceDate = row.price_date ? String(row.price_date) : null;
    const currency = row.currency ? String(row.currency) : market === "US" ? "USD" : "KRW";

    const portfolio = portfolioMap.get(id);
    const avgPrice = portfolio?.avgPrice ?? null;
    const quantity = portfolio?.quantity ?? 0;

    // 보유 수익률 (평균단가 대비)
    const holdingReturn =
      currentPrice != null && avgPrice != null && avgPrice > 0
        ? ((currentPrice - avgPrice) / avgPrice) * 100
        : null;

    // 평가금액 (KRW 환산)
    const evalAmountKRW =
      currentPrice != null && quantity > 0
        ? currency === "USD"
          ? currentPrice * quantity * usdkrw
          : currentPrice * quantity
        : null;

    return {
      id,
      ticker,
      name,
      market,
      category,
      broker,
      thesis,
      isActive,
      currentPrice,
      priceDate,
      currency,
      quantity,
      avgPrice,
      holdingReturn,
      evalAmountKRW,
    };
  });

  return NextResponse.json({ stocks, usdkrw });
}
