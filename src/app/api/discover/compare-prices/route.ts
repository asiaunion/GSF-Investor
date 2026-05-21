import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface PricePoint {
  date: string;
  close: number;
}

/**
 * GET /api/discover/compare-prices
 * 
 * 쿼리 파라미터:
 * - tickers: 쉼표로 구분된 티커 리스트 (예: 005380,AAPL)
 * - range: '1M' | '3M' | '6M' | '1Y' (기본값 3M)
 */
export async function GET(req: NextRequest) {
  let session = await auth();
  if (process.env.DEV_PREVIEW_AUTH === "true") {
    session = session || {
      user: { email: "preview@gsf-investor.local", name: "Design Preview" },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const tickersRaw = searchParams.get("tickers") ?? "";
  const range = searchParams.get("range") ?? "3M";

  const tickers = tickersRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tickers.length === 0) {
    return NextResponse.json(
      { error: "Bad Request", message: "At least one ticker must be provided" },
      { status: 400 }
    );
  }

  // 1. 시작 날짜 계산
  const now = new Date();
  let diffDays = 90;
  if (range === "1M") diffDays = 30;
  else if (range === "3M") diffDays = 90;
  else if (range === "6M") diffDays = 180;
  else if (range === "1Y") diffDays = 365;

  const startDate = new Date();
  startDate.setDate(now.getDate() - diffDays);
  const startDateStr = startDate.toISOString().slice(0, 10);

  try {
    const metaList = [];
    const tickerToPricesMap = new Map<string, PricePoint[]>();
    const allDatesSet = new Set<string>();

    for (const ticker of tickers) {
      // 종목 조회
      const stockRes = await db.run(sql`
        SELECT id, ticker, name, market FROM stocks
        WHERE ticker = ${ticker} AND is_active = 1
        LIMIT 1
      `);

      if (!stockRes.rows.length) {
        continue; // 활성화되지 않았거나 존재하지 않는 티커는 제외
      }

      const stockRow = stockRes.rows[0];
      const stockId = Number(stockRow[0]);
      const name = String(stockRow[2]);
      const market = String(stockRow[3]);

      metaList.push({ stockId, ticker, name, market });

      // 기간 주가 조회
      const pricesRes = await db.run(sql`
        SELECT date, close_price FROM prices
        WHERE stock_id = ${stockId} AND date >= ${startDateStr}
        ORDER BY date ASC
      `);

      const priceList: PricePoint[] = [];
      for (const pr of pricesRes.rows) {
        const d = String(pr[0]);
        const c = pr[1] != null ? Number(pr[1]) : 0;
        if (c > 0) {
          priceList.push({ date: d, close: c });
          allDatesSet.add(d);
        }
      }
      
      if (priceList.length > 0) {
        tickerToPricesMap.set(ticker, priceList);
      }
    }

    // 2. 날짜 정렬
    const sortedDates = Array.from(allDatesSet).sort();

    // 3. 각 티커별 basePrice(기간 중 첫째 유효 가격) 확보
    const basePricesMap = new Map<string, number>();
    for (const [ticker, pList] of tickerToPricesMap.entries()) {
      if (pList.length > 0) {
        basePricesMap.set(ticker, pList[0].close);
      }
    }

    // 4. 시계열 데이터 병합 및 정규화
    // Recharts용 최종 데이터셋: { date: 'YYYY-MM-DD', 'AAPL': 102.3, '005380': 98.5 }
    // 가격이 누락된 날짜는 이전 날짜의 정규화 비율로 채우는(Forward-fill) 로직 적용
    const timeSeriesData: Record<string, any>[] = [];
    const lastNormMap = new Map<string, number>();

    for (const date of sortedDates) {
      const point: Record<string, any> = { date };

      for (const [ticker, pList] of tickerToPricesMap.entries()) {
        const match = pList.find((p) => p.date === date);
        const basePrice = basePricesMap.get(ticker) ?? 1;

        if (match) {
          const normVal = (match.close / basePrice) * 100;
          const roundedVal = Math.round(normVal * 100) / 100;
          point[ticker] = roundedVal;
          lastNormMap.set(ticker, roundedVal);
        } else {
          // 누락 날짜는 이전 값으로 채움
          const lastVal = lastNormMap.get(ticker);
          if (lastVal != null) {
            point[ticker] = lastVal;
          } else {
            point[ticker] = 100.0; // 이전 값이 없으면 최초 100으로 시작
          }
        }
      }

      timeSeriesData.push(point);
    }

    return NextResponse.json({
      success: true,
      range,
      startDate: startDateStr,
      meta: metaList,
      chartData: timeSeriesData,
    });
  } catch (error: any) {
    console.error("Compare Prices API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}
