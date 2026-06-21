import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { toObjs, toObj } from "@/lib/db-utils";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // v_portfolio는 이미 stock_id를 포함하므로 JOIN 불필요
    const portfolioRows = await db.run(sql`
      SELECT stock_id, ticker, name, market, category, broker, quantity, avg_price, currency
      FROM v_portfolio
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
    for (const r of toObjs(latestPricesRows as unknown as import("@/lib/db-utils").RawResult)) {
      latestPriceMap.set(Number(r.stock_id), {
        closePrice: Number(r.close_price),
        currency: String(r.currency),
        date: String(r.date),
      });
    }

    if (!fxRow.rows.length) {
      return NextResponse.json({ error: "환율 데이터 없음 — daily_price.py를 먼저 실행하세요" }, { status: 500 });
    }
    const fxObjs = toObjs(fxRow as unknown as import("@/lib/db-utils").RawResult);
    const usdkrw = Number(fxObjs[0].rate);
    const fxDate = String(fxObjs[0].date);

    const holdings = toObjs(portfolioRows as unknown as import("@/lib/db-utils").RawResult).map((row) => {
      const stockId = Number(row.stock_id);
      const ticker = String(row.ticker);
      const name = String(row.name);
      const market = String(row.market);
      const category = String(row.category);
      const broker = row.broker ? String(row.broker) : null;
      const quantity = Number(row.quantity);
      const avgPrice = Number(row.avg_price);
      const currency = String(row.currency);

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
