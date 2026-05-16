/**
 * src/lib/gemini.ts
 * Gemini API 공통 유틸리티 — 프롬프트 빌더 + 호출 헬퍼
 */

export const GEMINI_MODEL = "gemini-2.5-flash-preview-05-20";
export const GEMINI_MAX_TOKENS = 8192;

// ── 타입 ──────────────────────────────────────────────────────────────────────

export type FinancialData = {
  period: string;
  revenue: number | null;
  opIncome: number | null;
  netIncome: number | null;
  debtRatio: number | null;
  eps: number | null;
  bps: number | null;
  roe: number | null;
  dividendPerShare: number | null;
  freeCashFlow: number | null;
  source: string;
};

export type PriceData = { date: string; close: number };

export type SignalData = {
  type: string;
  severity: string;
  description: string;
  detectedAt: string;
};

export type DisclosureData = {
  title: string;
  filedAt: string;
  source: string;
};

export type StockContext = {
  stockId: number;
  ticker: string;
  name: string;
  market: string;
  category: string;
  thesis: string;
};

// ── PER / PBR 계산 ────────────────────────────────────────────────────────────

export function calcPerPbr(
  currentPrice: number,
  financials: FinancialData[]
): { per: string; pbr: string } {
  const latestFin = financials[0] ?? null;
  const per =
    latestFin?.eps && currentPrice > 0 && latestFin.eps > 0
      ? (currentPrice / latestFin.eps).toFixed(1)
      : "N/A";
  const pbr =
    latestFin?.bps && currentPrice > 0 && latestFin.bps > 0
      ? (currentPrice / latestFin.bps).toFixed(2)
      : "N/A";
  return { per, pbr };
}

// ── 공통 프롬프트 빌더 ────────────────────────────────────────────────────────

export function buildAnalysisPrompt(params: {
  stock: StockContext;
  financials: FinancialData[];
  prices: PriceData[];
  signals: SignalData[];
  disclosures: DisclosureData[];
  usdkrw: number;
}): string {
  const { stock, financials, prices, signals, disclosures, usdkrw } = params;
  const { ticker, name, market, category, thesis } = stock;
  const latestPrice = prices[0] ?? null;
  const currentPrice = latestPrice?.close ?? 0;
  const { per, pbr } = calcPerPbr(currentPrice, financials);

  return `당신은 전문 투자 분석가입니다. 다음 데이터를 바탕으로 ${name}(${ticker}, ${market} 시장)에 대한 투자 분석 보고서를 한국어로 작성하세요.

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
${
  financials.length === 0
    ? "재무 데이터 없음"
    : financials
        .map(
          (f) => `
- ${f.period} (${f.source})
  매출: ${f.revenue != null ? f.revenue.toLocaleString() : "N/A"}
  영업이익: ${f.opIncome != null ? f.opIncome.toLocaleString() : "N/A"}
  순이익: ${f.netIncome != null ? f.netIncome.toLocaleString() : "N/A"}
  부채비율: ${f.debtRatio != null ? f.debtRatio.toFixed(1) + "%" : "N/A"}
  EPS: ${f.eps != null ? f.eps.toLocaleString() : "N/A"}
  BPS: ${f.bps != null ? f.bps.toLocaleString() : "N/A"}
  ROE: ${f.roe != null ? f.roe.toFixed(1) + "%" : "N/A"}
  배당: ${f.dividendPerShare != null ? f.dividendPerShare.toLocaleString() : "N/A"}`
        )
        .join("")
}

## 미해결 시그널 (${signals.length}건)
${
  signals.length === 0
    ? "미해결 시그널 없음"
    : signals
        .map((s) => `- [${s.severity}] ${s.type}: ${s.description} (${s.detectedAt})`)
        .join("\n")
}

## 최근 공시 (${disclosures.length}건)
${
  disclosures.length === 0
    ? "최근 공시 없음"
    : disclosures.map((d) => `- [${d.source}] ${d.filedAt} ${d.title}`).join("\n")
}

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
}

// ── chartsJson 빌더 ───────────────────────────────────────────────────────────

export function buildChartsJson(
  prices: PriceData[],
  financials: FinancialData[]
): string {
  return JSON.stringify({
    prices: prices.slice(0, 30).reverse(),
    financials: financials
      .map((f) => ({
        period: f.period,
        revenue: f.revenue,
        opIncome: f.opIncome,
        netIncome: f.netIncome,
      }))
      .reverse(),
  });
}
