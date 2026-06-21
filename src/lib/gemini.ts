/**
 * src/lib/gemini.ts
 * Gemini API 공통 유틸리티 — 프롬프트 빌더 + 호출 헬퍼 + 팩트체크 레이어
 */

export const GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_MAX_TOKENS = 8192;

// Google Search Grounding — 최신 뉴스·시황을 AI 보고서에 반영
// Gemini 2.0+ 에서 지원. 프롬프트 내 최신 정보 검색을 허용.
export const GEMINI_TOOLS_WITH_SEARCH = [{ google_search: {} }];

// ── 팩트체크 레이어 ───────────────────────────────────────────────────────────

export type FactCheckItem = {
  label: string;      // 검증 항목 이름 (예: "EPS 2024Q4")
  dbValue: number;    // DB 실제 값
  unit: string;       // 단위 (원, %, 배)
  status: "verified" | "warning" | "error" | "not_found";
  note: string;       // 검증 결과 설명
};

export type FactCheckResult = {
  checkedAt: string;
  totalChecked: number;
  verified: number;
  warnings: number;
  errors: number;
  items: FactCheckItem[];
};

/**
 * AI 보고서 팩트체크
 * - DB 실제 재무수치 vs. 보고서 마크다운 내 숫자 교차검증
 * - 허용 오차: ±5% (숫자 표기 방식 차이 고려)
 * - 보고서에서 숫자를 못 찾으면 "not_found" 처리 (오류 아님)
 */
export function factCheckReport(
  contentMd: string,
  financials: FinancialData[]
): FactCheckResult {
  const checkedAt = new Date().toISOString();
  const items: FactCheckItem[] = [];

  if (!financials.length) {
    return { checkedAt, totalChecked: 0, verified: 0, warnings: 0, errors: 0, items };
  }

  const latest = financials[0];

  // 검증 대상 수치 목록
  const targets: { label: string; value: number | null; unit: string }[] = [
    { label: `매출 (${latest.period})`, value: latest.revenue, unit: "원" },
    { label: `영업이익 (${latest.period})`, value: latest.opIncome, unit: "원" },
    { label: `순이익 (${latest.period})`, value: latest.netIncome, unit: "원" },
    { label: `EPS (${latest.period})`, value: latest.eps, unit: "원" },
    { label: `BPS (${latest.period})`, value: latest.bps, unit: "원" },
    { label: `ROE (${latest.period})`, value: latest.roe, unit: "%" },
    { label: `부채비율 (${latest.period})`, value: latest.debtRatio, unit: "%" },
  ];

  // 보고서에서 모든 숫자 추출 (콤마 제거 후 파싱)
  const numberPattern = /([\d,]+(?:\.\d+)?)/g;
  const numsInReport: number[] = [];
  let match;
  while ((match = numberPattern.exec(contentMd)) !== null) {
    const n = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(n) && n > 0) numsInReport.push(n);
  }

  // 보고서에서 자주 쓰이는 단위 스케일 (억원 = 1e8, 조원 = 1e12, 백만원 = 1e6)
  const UNIT_SCALES = [1, 1e8, 1e12, 1e6];

  for (const target of targets) {
    if (target.value === null || target.value === undefined) continue;
    const dbAbs = Math.abs(target.value);
    if (dbAbs < 0.01) continue; // 0에 가까운 값 스킵

    // 보고서에서 ±5% 범위 내 숫자 찾기 (단위 스케일 보정 포함)
    const TOLERANCE = 0.05;
    const found = numsInReport.some((n) =>
      UNIT_SCALES.some((scale) => {
        const scaled = dbAbs / scale;
        return scaled > 0.01 && Math.abs(n - scaled) / scaled <= TOLERANCE;
      })
    );

    let status: FactCheckItem["status"];
    let note: string;

    if (!found) {
      // 보고서에 해당 수치가 없음 → not_found (경고 수준)
      status = "not_found";
      note = `DB값 ${target.value.toLocaleString()}${target.unit} — 보고서 내 미언급`;
    } else {
      status = "verified";
      note = `DB값 ${target.value.toLocaleString()}${target.unit} — 보고서 일치 확인 (±5% 허용)`;
    }

    items.push({ label: target.label, dbValue: target.value, unit: target.unit, status, note });
  }

  // 통계 집계
  const verified = items.filter((i) => i.status === "verified").length;
  const warnings = items.filter((i) => i.status === "not_found" || i.status === "warning").length;
  const errors = items.filter((i) => i.status === "error").length;

  return {
    checkedAt,
    totalChecked: items.length,
    verified,
    warnings,
    errors,
    items,
  };
}

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

  return `당신은 전문 투자 분석가입니다. 다음 내부 데이터와 함께 Google 검색을 통해 ${name}(${ticker})에 대한 최신 뉴스, 시장 동향, 업종 이슈를 반드시 조회한 후 투자 분석 보고서를 한국어로 작성하세요. 검색 결과를 인용할 때는 출처(날짜, 매체)를 명시하세요.

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

## 검색 지시사항
Google 검색을 통해 다음을 반드시 조회하세요:
1. "${name}" 또는 "${ticker}" 관련 최근 1개월 뉴스
2. 해당 업종(${category}) 최신 트렌드 및 경쟁 동향
3. ${market === "KR" ? "KOSPI/KOSDAQ 시장" : "미국 시장"} 매크로 환경 (금리, 환율, 수급)
4. 실적 발표 예정일 또는 최근 IR 내용

---

다음 구조로 투자 분석 보고서를 마크다운 형식으로 작성하세요:

# ${name}(${ticker}) 투자 분석 보고서

## 1. 요약 (3줄)
[3줄 이내 핵심 요약]

## 2. 최신 시황 (검색 결과 기반)
[최근 뉴스·업종 동향·매크로 환경 요약 — 출처(날짜) 명시]

## 3. 시그널 해석
[감지된 시그널의 투자 관점 해석]

## 4. 재무 분석
[매출/영업이익 추세, 부채비율, ROE 등 핵심 지표 분석]

## 5. 시나리오 분석
### 낙관 시나리오
### 기본 시나리오
### 비관 시나리오

## 6. 투자 판단
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
