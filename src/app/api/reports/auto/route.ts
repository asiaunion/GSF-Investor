// src/app/api/reports/auto/route.ts
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

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

  for (const row of stockRows.rows) {
    const stockId = Number(row[0]);
    const ticker = String(row[1]);
    const name = String(row[2]);
    const market = String(row[3]);
    const category = String(row[4]);
    const thesis = row[5] ? String(row[5]) : "투자 테제 미입력";

    // 3️⃣ 최신 재무, 주가, 시그널, 공시 데이터를 가져와 프롬프트 생성 (동일 로직을 generate API와 공유)
    const finRows = await db.run(sql`
      SELECT period, revenue, op_income, net_income, debt_ratio, eps, bps, roe, dividend_per_share, free_cash_flow, source
      FROM financials
      WHERE stock_id = ${stockId}
      ORDER BY period DESC LIMIT 4`
    );
    const financials = finRows.rows.map((r) => ({
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

    const priceRows = await db.run(sql`
      SELECT date, close_price FROM prices
      WHERE stock_id = ${stockId}
      ORDER BY date DESC LIMIT 30`
    );
    const prices = priceRows.rows.map((r) => ({ date: String(r[0]), close: Number(r[1]) }));

    const sigRows = await db.run(sql`
      SELECT type, severity, description, detected_at
      FROM signals
      WHERE stock_id = ${stockId} AND is_resolved = 0
      ORDER BY detected_at DESC LIMIT 5`
    );
    const signals = sigRows.rows.map((r) => ({
      type: String(r[0]),
      severity: String(r[1]),
      description: String(r[2]),
      detectedAt: String(r[3]),
    }));

    const discRows = await db.run(sql`
      SELECT title, filed_at, source FROM disclosures
      WHERE stock_id = ${stockId}
      ORDER BY filed_at DESC LIMIT 5`
    );
    const disclosures = discRows.rows.map((r) => ({
      title: String(r[0]),
      filedAt: String(r[1]),
      source: String(r[2]),
    }));

    const latestPrice = prices[0] ?? null;
    const fxRow = await db.run(sql`
      SELECT rate FROM exchange_rates WHERE pair = 'USDKRW' ORDER BY date DESC LIMIT 1`
    );
    const usdkrw = fxRow.rows.length ? Number(fxRow.rows[0][0]) : 1300;
    const currentPrice = latestPrice?.close ?? 0;
    const latestFin = financials[0] ?? null;
    const per = latestFin?.eps && currentPrice > 0 && latestFin.eps > 0
      ? (currentPrice / latestFin.eps).toFixed(1)
      : "N/A";
    const pbr = latestFin?.bps && currentPrice > 0 && latestFin.bps > 0
      ? (currentPrice / latestFin.bps).toFixed(2)
      : "N/A";

    const prompt = `당신은 전문 투자 분석가입니다. 다음 데이터를 바탕으로 ${name}(${ticker}, ${market} 시장)에 대한 투자 분석 보고서를 한국어로 작성하세요.

## 종목 정보
- 종목: ${name} (${ticker})
- 시장: ${market === "KR" ? "한국 (KRX)" : "미국 (NYSE/NASDAQ)"}
- 투자 카테고리: ${category}
- 현재 투자 테제: ${thesis}

## 최신 주가
${latestPrice ? `- 최근 종가: ${currentPrice.toLocaleString()} (${latestPrice.date})` : "- 주가 데이터 없음"}
- PER: ${per} | PBR: ${pbr}
${market === "US" ? `- USD/KRW: ${usdkrw.toLocaleString()}` : ""}

## 최근 4분기 재무 데이터
${financials.length === 0 ? "재무 데이터 없음" : financials.map((f) => `
- ${f.period} (${f.source})
  매출: ${f.revenue != null ? f.revenue.toLocaleString() : "N/A"}
  영업이익: ${f.opIncome != null ? f.opIncome.toLocaleString() : "N/A"}
  순이익: ${f.netIncome != null ? f.netIncome.toLocaleString() : "N/A"}
  부채비율: ${f.debtRatio != null ? f.debtRatio.toFixed(1) + "%" : "N/A"}
  EPS: ${f.eps != null ? f.eps.toLocaleString() : "N/A"}
  BPS: ${f.bps != null ? f.bps.toLocaleString() : "N/A"}
  ROE: ${f.roe != null ? f.roe.toFixed(1) + "%" : "N/A"}
  배당: ${f.dividendPerShare != null ? f.dividendPerShare.toLocaleString() : "N/A"}`).join("")}

## 미해결 시그널 (${signals.length}건)
${signals.length === 0 ? "미해결 시그널 없음" : signals.map((s) => `- [${s.severity}] ${s.type}: ${s.description} (${s.detectedAt})`).join("\n")}

## 최근 공시 (${disclosures.length}건)
${disclosures.length === 0 ? "최근 공시 없음" : disclosures.map((d) => `- [${d.source}] ${d.filedAt} ${d.title}`).join("\n")}

---

다음 구조로 투자 분석 보고서를 마크다운 형식으로 작성하세요:

# ${name}(${ticker}) 투자 분석 보고서

## 1. 요약 (3줄)
[3줄 이내 핵심 요약]

## 2. 시그널 해석
[감지된 시그널의 투자 관점 해석]

## 3. 재무 분석
[매출/영업이익 추세, 부채비율, ROE 등 핵심 지표 분석]

## 4. 시나리오 분석
### 낙관 시나리오
### 기본 시나리오
### 비관 시나리오

## 5. 투자 판단
[현재 투자 테제 유효성 검토, 확신도 변화 (★★★★★ 중 선택), 주요 모니터링 포인트]

분석 시 구체적인 수치를 인용하고 근거를 명확히 제시하세요.`;

    // 4️⃣ Gemini 호출 (generateContent – 스트리밍이 아닌 단일 호출)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    let geminiResponse: Response;
    try {
      geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
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

    const chartsJson = JSON.stringify({
      prices: prices.slice(0, 30).reverse(),
      financials: financials.map((f) => ({ period: f.period, revenue: f.revenue, opIncome: f.opIncome, netIncome: f.netIncome })).reverse(),
    });

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
