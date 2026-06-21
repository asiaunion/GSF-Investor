import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { toObj, toObjs } from "@/lib/db-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/stocks/[ticker]/snapshot-history
 * 종목별 보유 수익률 히스토리 (holding_snapshots 기반)
 * 반환: [{ date, marketValueKrw, unrealizedPnlKrw, returnPct }]
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticker } = await params;

  const stockRow = await db.run(sql`
    SELECT id FROM stocks WHERE ticker = ${ticker} AND is_active = 1 LIMIT 1
  `);
  if (!stockRow.rows.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const stockId = Number(toObj(stockRow as unknown as import("@/lib/db-utils").RawResult).id);

  const rows = await db.run(sql`
    SELECT date, quantity, avg_price, market_price, market_value_krw, unrealized_pnl_krw, currency
    FROM holding_snapshots
    WHERE stock_id = ${stockId}
    ORDER BY date ASC
  `);

  const history = toObjs(rows as unknown as import("@/lib/db-utils").RawResult).map((r) => {
    const marketValueKrw = r.market_value_krw != null ? Number(r.market_value_krw) : null;
    const unrealizedPnlKrw = r.unrealized_pnl_krw != null ? Number(r.unrealized_pnl_krw) : null;
    const qty = r.quantity != null ? Number(r.quantity) : null;
    const avgPrice = r.avg_price != null ? Number(r.avg_price) : null;
    const marketPrice = r.market_price != null ? Number(r.market_price) : null;

    const costKrw = marketValueKrw != null && unrealizedPnlKrw != null
      ? marketValueKrw - unrealizedPnlKrw
      : null;
    const returnPct =
      costKrw && costKrw > 0 && unrealizedPnlKrw != null
        ? (unrealizedPnlKrw / costKrw) * 100
        : null;

    return {
      date: String(r.date),
      marketValueKrw,
      unrealizedPnlKrw,
      returnPct,
      quantity: qty,
      avgPrice,
      marketPrice,
      currency: String(r.currency ?? "KRW"),
    };
  });

  return NextResponse.json({ ticker, history });
}
