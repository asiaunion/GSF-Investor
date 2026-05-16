import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";

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

  // v_portfolio — 현재 보유 수량·평균단가
  const portfolioRows = await db.run(sql`
    SELECT
      s.id AS stock_id,
      vp.quantity,
      vp.avg_price
    FROM v_portfolio vp
    JOIN stocks s ON s.ticker = vp.ticker
  `);

  const fxRow = await db.run(sql`
    SELECT rate FROM exchange_rates WHERE pair = 'USDKRW' ORDER BY date DESC LIMIT 1
  `);
  const usdkrw = fxRow.rows.length > 0 ? Number(fxRow.rows[0][0]) : 1300;

  const portfolioMap = new Map<number, { quantity: number; avgPrice: number }>();
  for (const row of portfolioRows.rows) {
    portfolioMap.set(Number(row[0]), {
      quantity: Number(row[1]),
      avgPrice: Number(row[2]),
    });
  }

  const stocks = stocksRows.rows.map((row) => {
    const id = Number(row[0]);
    const ticker = String(row[1]);
    const name = String(row[2]);
    const market = String(row[3]);
    const category = String(row[4]);
    const broker = row[5] ? String(row[5]) : null;
    const thesis = row[6] ? String(row[6]) : null;
    const isActive = Number(row[7]);
    const currentPrice = row[8] != null ? Number(row[8]) : null;
    const priceDate = row[9] ? String(row[9]) : null;
    const currency = row[10] ? String(row[10]) : market === "US" ? "USD" : "KRW";

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
