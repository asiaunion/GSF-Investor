import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// v_portfolio는 Turso에 생성된 View이므로 raw SQL로 접근
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 1) v_portfolio: 종목별 수량 + 평균단가 + currency
    const portfolioRows = await db.run(sql`
      SELECT
        vp.stock_id,
        vp.ticker,
        vp.name,
        vp.category,
        vp.broker,
        vp.quantity,
        vp.avg_price,
        vp.currency
      FROM v_portfolio vp
    `);

    // 2) 각 종목의 최신 종가 (prices 테이블)
    const latestPricesRows = await db.run(sql`
      SELECT
        p.stock_id,
        p.close_price,
        p.currency,
        p.date
      FROM prices p
      INNER JOIN (
        SELECT stock_id, MAX(date) AS max_date
        FROM prices
        GROUP BY stock_id
      ) latest ON p.stock_id = latest.stock_id AND p.date = latest.max_date
    `);

    // 3) 최신 USDKRW 환율
    const fxRow = await db.run(sql`
      SELECT rate, date
      FROM exchange_rates
      WHERE pair = 'USDKRW'
      ORDER BY date DESC
      LIMIT 1
    `);

    const latestPriceMap = new Map<number, { closePrice: number; currency: string; date: string }>();
    for (const row of latestPricesRows.rows) {
      latestPriceMap.set(Number(row[0]), {
        closePrice: Number(row[1]),
        currency: String(row[2]),
        date: String(row[3]),
      });
    }

    const usdkrw = fxRow.rows.length > 0 ? Number(fxRow.rows[0][0]) : 1300;
    const fxDate = fxRow.rows.length > 0 ? String(fxRow.rows[0][1]) : null;

    // 4) 종목별 평가금액 + 수익률 계산
    const holdings = portfolioRows.rows.map((row) => {
      const stockId = Number(row[0]);
      const ticker = String(row[1]);
      const name = String(row[2]);
      const category = String(row[3]);
      const broker = row[4] ? String(row[4]) : null;
      const quantity = Number(row[5]);
      const avgPrice = Number(row[6]);
      const currency = String(row[7]);

      const latest = latestPriceMap.get(stockId);
      const currentPrice = latest?.closePrice ?? avgPrice;
      const priceDate = latest?.date ?? null;

      // 평가금액 (원화 환산)
      const evalAmountLocal = currentPrice * quantity;
      const costAmountLocal = avgPrice * quantity;

      // USD 종목은 원화 환산
      const evalAmountKRW =
        currency === "USD" ? evalAmountLocal * usdkrw : evalAmountLocal;
      const costAmountKRW =
        currency === "USD" ? costAmountLocal * usdkrw : costAmountLocal;

      const returnRate =
        costAmountLocal > 0
          ? ((currentPrice - avgPrice) / avgPrice) * 100
          : 0;

      return {
        stockId,
        ticker,
        name,
        category,
        broker,
        quantity,
        avgPrice,
        currentPrice,
        currency,
        evalAmountKRW,
        costAmountKRW,
        returnRate,
        priceDate,
      };
    });

    // 5) 총 자산 / 총 수익률
    const totalEvalKRW = holdings.reduce((s, h) => s + h.evalAmountKRW, 0);
    const totalCostKRW = holdings.reduce((s, h) => s + h.costAmountKRW, 0);
    const totalReturnRate =
      totalCostKRW > 0
        ? ((totalEvalKRW - totalCostKRW) / totalCostKRW) * 100
        : 0;

    // 6) Core vs Satellite 비중 (평가금액 기준)
    const coreKRW = holdings
      .filter((h) => h.category === "Core")
      .reduce((s, h) => s + h.evalAmountKRW, 0);
    const satelliteKRW = holdings
      .filter((h) => h.category === "Satellite")
      .reduce((s, h) => s + h.evalAmountKRW, 0);

    return NextResponse.json({
      holdings,
      summary: {
        totalEvalKRW,
        totalCostKRW,
        totalReturnRate,
        usdkrw,
        fxDate,
        coreKRW,
        satelliteKRW,
      },
    });
  } catch (err) {
    console.error("[dashboard API]", err);
    return NextResponse.json(
      { error: "DB query failed", detail: String(err) },
      { status: 500 }
    );
  }
}
