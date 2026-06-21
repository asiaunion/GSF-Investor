import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import {
  buildAnalysisPrompt,
  buildChartsJson,
  type FinancialData,
  type PriceData,
  type SignalData,
  type DisclosureData,
} from "@/lib/gemini";
import { streamGemini, streamClaude } from "@/lib/ai-provider";
import { toObj, toObjs } from "@/lib/db-utils";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby: 60s

/**
 * POST /api/reports/generate
 * Body: { stockId: number, trigger?: "MANUAL" | "SIGNAL_AUTO" }
 *
 * Gemini API 스트리밍 응답으로 AI 분석 보고서를 생성하고
 * reports 테이블에 저장 후 스트림을 클라이언트에 전달.
 */
export async function POST(req: NextRequest) {
  // 인증 확인
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const stockId = Number(body.stockId);
  const trigger = body.trigger ?? "MANUAL";

  if (!stockId) {
    return NextResponse.json({ error: "stockId required" }, { status: 400 });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!geminiKey && !claudeKey) {
    return NextResponse.json({ error: "AI provider 없음 — GEMINI_API_KEY 또는 ANTHROPIC_API_KEY 필요" }, { status: 500 });
  }

  // 종목 정보 조회
  const stockRows = await db.run(sql`
    SELECT ticker, name, market, category, thesis FROM stocks WHERE id = ${stockId}
  `);
  if (!stockRows.rows.length) {
    return NextResponse.json({ error: "Stock not found" }, { status: 404 });
  }
  const stockRow = toObj(stockRows as unknown as import("@/lib/db-utils").RawResult, 0);
  const ticker = String(stockRow.ticker);
  const name = String(stockRow.name);
  const market = String(stockRow.market);
  const category = String(stockRow.category);
  const thesis = stockRow.thesis ? String(stockRow.thesis) : "투자 테제 미입력";

  // 최신 재무 데이터 (최근 4분기)
  const finRows = await db.run(sql`
    SELECT period, revenue, op_income, net_income, debt_ratio, eps, bps, roe,
           dividend_per_share, free_cash_flow, source
    FROM financials
    WHERE stock_id = ${stockId}
    ORDER BY period DESC LIMIT 4
  `);
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

  // 최근 주가 (30일)
  const priceRows = await db.run(sql`
    SELECT date, close_price FROM prices
    WHERE stock_id = ${stockId}
    ORDER BY date DESC LIMIT 30
  `);
  const prices: PriceData[] = toObjs(priceRows as unknown as import("@/lib/db-utils").RawResult).map((r) => ({
    date: String(r.date),
    close: Number(r.close_price),
  }));

  // 최근 시그널 (미해결)
  const sigRows = await db.run(sql`
    SELECT type, severity, description, detected_at
    FROM signals
    WHERE stock_id = ${stockId} AND is_resolved = 0
    ORDER BY detected_at DESC LIMIT 5
  `);
  const signals: SignalData[] = toObjs(sigRows as unknown as import("@/lib/db-utils").RawResult).map((r) => ({
    type: String(r.type),
    severity: String(r.severity),
    description: String(r.description),
    detectedAt: String(r.detected_at),
  }));

  // 최근 공시 (5건)
  const discRows = await db.run(sql`
    SELECT title, filed_at, source FROM disclosures
    WHERE stock_id = ${stockId}
    ORDER BY filed_at DESC LIMIT 5
  `);
  const disclosures: DisclosureData[] = toObjs(discRows as unknown as import("@/lib/db-utils").RawResult).map((r) => ({
    title: String(r.title),
    filedAt: String(r.filed_at),
    source: String(r.source),
  }));

  // 최신 환율
  const fxRow = await db.run(sql`
    SELECT rate FROM exchange_rates WHERE pair = 'USDKRW' ORDER BY date DESC LIMIT 1
  `);
  if (!fxRow.rows.length) {
    return NextResponse.json({ error: "환율 데이터 없음 — daily_price.py를 먼저 실행하세요" }, { status: 500 });
  }
  const usdkrw = Number(toObj(fxRow as unknown as import("@/lib/db-utils").RawResult, 0).rate);

  // 프롬프트 + chartsJson 구성 (공통 유틸 사용)
  const prompt = buildAnalysisPrompt({
    stock: { stockId, ticker, name, market, category, thesis },
    financials,
    prices,
    signals,
    disclosures,
    usdkrw,
  });
  const chartsJson = buildChartsJson(prices, financials);

  // ── AI 스트리밍 (Gemini → Claude fallback) ──────────────────────────────────
  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream({
    async start(controller) {
      // provider 결정: Gemini 우선, 없으면 Claude
      let provider: "gemini" | "claude" = geminiKey ? "gemini" : "claude";
      let textGen: AsyncGenerator<string>;

      try {
        if (provider === "gemini") {
          textGen = streamGemini(prompt, geminiKey!, 55_000);
        } else {
          textGen = streamClaude(prompt, claudeKey!, 55_000);
        }

        for await (const text of textGen) {
          fullText += text;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        }
      } catch (primaryErr) {
        // Gemini 실패 시 Claude로 fallback
        if (provider === "gemini" && claudeKey) {
          console.warn(`[AI] Gemini failed (${primaryErr}), falling back to Claude`);
          provider = "claude";
          fullText = "";
          try {
            textGen = streamClaude(prompt, claudeKey, 55_000);
            for await (const text of textGen) {
              fullText += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          } catch (fallbackErr) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ done: true, saved: false, error: `Both providers failed: ${fallbackErr}` })}\n\n`)
            );
            controller.close();
            return;
          }
        } else {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true, saved: false, error: String(primaryErr) })}\n\n`)
          );
          controller.close();
          return;
        }
      }

      // 생성 완료 → DB 저장
      if (fullText) {
        try {
          await db.run(sql`
            INSERT INTO reports (stock_id, trigger, content_md, charts_json, generated_at)
            VALUES (${stockId}, ${trigger}, ${fullText}, ${chartsJson}, datetime('now'))
          `);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true, saved: true, provider })}\n\n`)
          );
        } catch (dbErr) {
          console.error("Report DB save error:", dbErr);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, saved: false, provider, error: String(dbErr) })}\n\n`
            )
          );
        }
      } else {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, saved: false, provider })}\n\n`)
        );
      }

      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
