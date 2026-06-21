// src/app/api/reports/auto/route.ts
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import {
  GEMINI_MODEL,
  GEMINI_MAX_TOKENS,
  GEMINI_TOOLS_WITH_SEARCH,
  buildAnalysisPrompt,
  buildChartsJson,
  type FinancialData,
  type PriceData,
  type SignalData,
  type DisclosureData,
} from "@/lib/gemini";
import { toObjs, toObj } from "@/lib/db-utils";

export const runtime = "nodejs";
export const maxDuration = 300; // allow longer execution for batch processing

/**
 * POST /api/reports/auto
 * Generates AI analysis reports for all active stocks that have at least one unresolved HIGH‑severity signal.
 * Stores the reports in the `reports` table. Returns a JSON summary.
 */
export async function POST(req: NextRequest) {
  // 1️⃣ 인증 확인 (1인 사용자만 허용)
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  // 2️⃣ 활성 종목 중, HIGH 시그널이 존재하는 종목 조회
  const stockRows = await db.run(sql`
    SELECT s.id, s.ticker, s.name, s.market, s.category, s.thesis
    FROM stocks s
    JOIN signals sig ON sig.stock_id = s.id
    WHERE s.is_active = 1 AND sig.severity = 'HIGH' AND sig.is_resolved = 0
    GROUP BY s.id`
  );
  if (!stockRows.rows.length) {
    return NextResponse.json({ message: "No stocks with HIGH signals found" });
  }

  const reportsCreated: { ticker: string; inserted: boolean }[] = [];

  // 환율은 루프 밖에서 1회만 조회
  const fxRow = await db.run(sql`
    SELECT rate FROM exchange_rates WHERE pair = 'USDKRW' ORDER BY date DESC LIMIT 1`
  );
  if (!fxRow.rows.length) {
    return NextResponse.json({ error: "환율 데이터 없음 — daily_price.py를 먼저 실행하세요" }, { status: 500 });
  }
  const usdkrw = Number(toObj(fxRow as unknown as import("@/lib/db-utils").RawResult).rate);

  for (const row of toObjs(stockRows as unknown as import("@/lib/db-utils").RawResult)) {
    const stockId = Number(row.id);
    const ticker = String(row.ticker);
    const name = String(row.name);
    const market = String(row.market);
    const category = String(row.category);
    const thesis = row.thesis ? String(row.thesis) : "투자 테제 미입력";

    // 3️⃣ 데이터 수집
    const finRows = await db.run(sql`
      SELECT period, revenue, op_income, net_income, debt_ratio, eps, bps, roe, dividend_per_share, free_cash_flow, source
      FROM financials
      WHERE stock_id = ${stockId}
      ORDER BY period DESC LIMIT 4`
    );
    const financials: FinancialData[] = toObjs(finRows as unknown as import("@/lib/db-utils").RawResult).map((r) => ({
      period: String(r.period ?? ""),
      revenue: r.revenue != null ? Number(r.revenue) : null,
      opIncome: r.op_income != null ? Number(r.op_income) : null,
      netIncome: r.net_income != null ? Number(r.net_income) : null,
      debtRatio: r.debt_ratio != null ? Number(r.debt_ratio) : null,
      eps: r.eps != null ? Number(r.eps) : null,
      bps: r.bps != null ? Number(r.bps) : null,
      roe: r.roe != null ? Number(r.roe) : null,
      dividendPerShare: r.dividend_per_share != null ? Number(r.dividend_per_share) : null,
      freeCashFlow: r.free_cash_flow != null ? Number(r.free_cash_flow) : null,
      source: String(r.source ?? ""),
    }));

    const priceRows = await db.run(sql`
      SELECT date, close_price FROM prices
      WHERE stock_id = ${stockId}
      ORDER BY date DESC LIMIT 30`
    );
    const prices: PriceData[] = toObjs(priceRows as unknown as import("@/lib/db-utils").RawResult).map((r) => ({
      date: String(r.date),
      close: Number(r.close_price),
    }));

    const sigRows = await db.run(sql`
      SELECT type, severity, description, detected_at
      FROM signals
      WHERE stock_id = ${stockId} AND is_resolved = 0
      ORDER BY detected_at DESC LIMIT 5`
    );
    const signals: SignalData[] = toObjs(sigRows as unknown as import("@/lib/db-utils").RawResult).map((r) => ({
      type: String(r.type),
      severity: String(r.severity),
      description: String(r.description),
      detectedAt: String(r.detected_at),
    }));

    const discRows = await db.run(sql`
      SELECT title, filed_at, source FROM disclosures
      WHERE stock_id = ${stockId}
      ORDER BY filed_at DESC LIMIT 5`
    );
    const disclosures: DisclosureData[] = toObjs(discRows as unknown as import("@/lib/db-utils").RawResult).map((r) => ({
      title: String(r.title),
      filedAt: String(r.filed_at),
      source: String(r.source),
    }));

    // 프롬프트 + chartsJson (공통 유틸 사용)
    const prompt = buildAnalysisPrompt({
      stock: { stockId, ticker, name, market, category, thesis },
      financials,
      prices,
      signals,
      disclosures,
      usdkrw,
    });
    const chartsJson = buildChartsJson(prices, financials);

    // 4️⃣ Gemini 호출 (generateContent – 단일 호출)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    let geminiResponse: Response;
    try {
      geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        signal: AbortSignal.timeout(280_000), // maxDuration 300s 기준 여유 20s
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: GEMINI_TOOLS_WITH_SEARCH,
          generationConfig: { temperature: 0.7, maxOutputTokens: GEMINI_MAX_TOKENS },
        }),
      });
    } catch (err) {
      console.error(`Gemini fetch failed for ${ticker}:`, err);
      reportsCreated.push({ ticker, inserted: false });
      continue;
    }
    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error(`Gemini API error for ${ticker}: ${errText.slice(0, 200)}`);
      reportsCreated.push({ ticker, inserted: false });
      continue;
    }
    const geminiData = await geminiResponse.json();
    const fullText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!fullText) {
      console.error(`Empty Gemini response for ${ticker}`);
      reportsCreated.push({ ticker, inserted: false });
      continue;
    }

    // 5️⃣ DB 저장
    let saved = false;
    try {
      await db.run(sql`
        INSERT INTO reports (stock_id, trigger, content_md, charts_json, generated_at)
        VALUES (${stockId}, ${"AUTO"}, ${fullText}, ${chartsJson}, datetime('now'))
      `);
      saved = true;
    } catch (dbErr) {
      console.error(`Report DB save error for ${ticker}:`, dbErr);
    }
    reportsCreated.push({ ticker, inserted: saved });
  }

  return NextResponse.json({ message: "Auto report generation completed", reportsCreated });
}
