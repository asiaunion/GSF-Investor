import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// 실제 v_portfolio 컬럼: ticker, name, market, category, broker, quantity, avg_price, currency
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // v_portfolio + stocks JOIN → stock_id 확보
    const portfolioRows = await db.run(sql`
      SELECT
        s.id AS stock_id,
        vp.ticker,
        vp.name,
        vp.market,
        vp.category,
        vp.broker,
        vp.quantity,
        vp.avg_price,
        vp.currency
      FROM v_portfolio vp
      JOIN stocks s ON s.ticker = vp.ticker
    `);

    // 최신 종가
    const latestPricesRows = await db.run(sql`
      SELECT p.stock_id, p.close_price, p.currency, p.date
      FROM prices p
      INNER JOIN (
        SELECT stock_id, MAX(date) AS max_date
        FROM prices
        GROUP BY stock_id
      ) latest ON p.stock_id = latest.stock_id AND p.date = latest.max_date
    `);

    // 최신 환율
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

    // 컬럼 인덱스: stock_id(0), ticker(1), name(2), market(3), category(4), broker(5), quantity(6), avg_price(7), currency(8)
    const holdings = portfolioRows.rows.map((row) => {
      const stockId = Number(row[0]);
      const ticker = String(row[1]);
      const name = String(row[2]);
      const market = String(row[3]);
      const category = String(row[4]);
      const broker = row[5] ? String(row[5]) : null;
      const quantity = Number(row[6]);
      const avgPrice = Number(row[7]);
      const currency = String(row[8]);

      const latest = latestPriceMap.get(stockId);
      const currentPrice = latest?.closePrice ?? avgPrice;
      const priceDate = latest?.date ?? null;

      const evalAmountLocal = currentPrice * quantity;
      const costAmountLocal = avgPrice * quantity;

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
        market,
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

    const totalEvalKRW = holdings.reduce((s, h) => s + h.evalAmountKRW, 0);
    const totalCostKRW = holdings.reduce((s, h) => s + h.costAmountKRW, 0);
    const totalReturnRate =
      totalCostKRW > 0
        ? ((totalEvalKRW - totalCostKRW) / totalCostKRW) * 100
        : 0;

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
