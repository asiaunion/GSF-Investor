import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import {
  GEMINI_MODEL,
  GEMINI_MAX_TOKENS,
  buildAnalysisPrompt,
  buildChartsJson,
  type FinancialData,
  type PriceData,
  type SignalData,
  type DisclosureData,
} from "@/lib/gemini";

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
  if (!geminiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  // 종목 정보 조회
  const stockRows = await db.run(sql`
    SELECT ticker, name, market, category, thesis FROM stocks WHERE id = ${stockId}
  `);
  if (!stockRows.rows.length) {
    return NextResponse.json({ error: "Stock not found" }, { status: 404 });
  }
  const stock = stockRows.rows[0];
  const ticker = String(stock[0]);
  const name = String(stock[1]);
  const market = String(stock[2]);
  const category = String(stock[3]);
  const thesis = stock[4] ? String(stock[4]) : "투자 테제 미입력";

  // 최신 재무 데이터 (최근 4분기)
  const finRows = await db.run(sql`
    SELECT period, revenue, op_income, net_income, debt_ratio, eps, bps, roe,
           dividend_per_share, free_cash_flow, source
    FROM financials
    WHERE stock_id = ${stockId}
    ORDER BY period DESC LIMIT 4
  `);
  const financials: FinancialData[] = finRows.rows.map((r) => ({
    period: String(r[0] ?? ""),
    revenue: r[1] != null ? Number(r[1]) : null,
    opIncome: r[2] != null ? Number(r[2]) : null,
    netIncome: r[3] != null ? Number(r[3]) : null,
    debtRatio: r[4] != null ? Number(r[4]) : null,
    eps: r[5] != null ? Number(r[5]) : null,
    bps: r[6] != null ? Number(r[6]) : null,
    roe: r[7] != null ? Number(r[7]) : null,
    dividendPerShare: r[8] != null ? Number(r[8]) : null,
    freeCashFlow: r[9] != null ? Number(r[9]) : null,
    source: String(r[10] ?? ""),
  }));

  // 최근 주가 (30일)
  const priceRows = await db.run(sql`
    SELECT date, close_price FROM prices
    WHERE stock_id = ${stockId}
    ORDER BY date DESC LIMIT 30
  `);
  const prices: PriceData[] = priceRows.rows.map((r) => ({
    date: String(r[0]),
    close: Number(r[1]),
  }));

  // 최근 시그널 (미해결)
  const sigRows = await db.run(sql`
    SELECT type, severity, description, detected_at
    FROM signals
    WHERE stock_id = ${stockId} AND is_resolved = 0
    ORDER BY detected_at DESC LIMIT 5
  `);
  const signals: SignalData[] = sigRows.rows.map((r) => ({
    type: String(r[0]),
    severity: String(r[1]),
    description: String(r[2]),
    detectedAt: String(r[3]),
  }));

  // 최근 공시 (5건)
  const discRows = await db.run(sql`
    SELECT title, filed_at, source FROM disclosures
    WHERE stock_id = ${stockId}
    ORDER BY filed_at DESC LIMIT 5
  `);
  const disclosures: DisclosureData[] = discRows.rows.map((r) => ({
    title: String(r[0]),
    filedAt: String(r[1]),
    source: String(r[2]),
  }));

  // 최신 환율
  const fxRow = await db.run(sql`
    SELECT rate FROM exchange_rates WHERE pair = 'USDKRW' ORDER BY date DESC LIMIT 1
  `);
  const usdkrw = fxRow.rows.length ? Number(fxRow.rows[0][0]) : 1300;

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

  // ── Gemini API 스트리밍 호출 ────────────────────────────────────────────────
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${geminiKey}`;

  let geminiResponse: Response;
  try {
    geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: GEMINI_MAX_TOKENS,
        },
      }),
    });
  } catch (err) {
    return NextResponse.json({ error: `Gemini fetch failed: ${err}` }, { status: 500 });
  }

  if (!geminiResponse.ok) {
    const errText = await geminiResponse.text();
    return NextResponse.json({ error: `Gemini API error: ${errText.slice(0, 200)}` }, { status: 500 });
  }

  // ── SSE 스트림 → 클라이언트 전달 + 전체 텍스트 수집 ────────────────────────
  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream({
    async start(controller) {
      const reader = geminiResponse.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(dataStr);
                const text =
                  parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
                if (text) {
                  fullText += text;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                  );
                }
              } catch {
                // JSON 파싱 실패 시 무시
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // 생성 완료 → DB 저장
      if (fullText) {
        try {
          await db.run(sql`
            INSERT INTO reports (stock_id, trigger, content_md, charts_json, generated_at)
            VALUES (${stockId}, ${trigger}, ${fullText}, ${chartsJson}, datetime('now'))
          `);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true, saved: true })}\n\n`)
          );
        } catch (dbErr) {
          console.error("Report DB save error:", dbErr);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, saved: false, error: String(dbErr) })}\n\n`
            )
          );
        }
      } else {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, saved: false })}\n\n`)
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
