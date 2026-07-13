# GSF-Investor Holdings 페이지 SWS 스타일 개선 — AG Work Order

**작성일**: 2026-07-13  
**브랜치**: `feature/ia-refactor` (현재 브랜치 유지)  
**검증 담당**: Claude  
**구현 담당**: AG  
**타입체크**: `npx tsc --noEmit` (0 errors 필수)  
**참고**: https://simplywall.st/portfolio/6583a56b-2c00-400c-8a8d-3ef0725990ad

---

## 전체 목표 (GPT 피드백 반영)

| Phase | 범위 | 핵심 목표 |
|-------|------|---------|
| **1** | 레이아웃·테이블·UI | SWS 스타일 시각 개선 |
| **2** | Research → Holdings 연결 | GSF 차별화 (Fair Value·Conviction·Next Catalyst) |
| 3 | Realized Returns·Currency Impact | 데이터 충분 후 |

> **이번 작업**: Phase 1 + Phase 2 모두 구현.  
> Overview 페이지(WealthClient)는 주식 이외 자산도 포함하므로 이번 작업 대상에서 제외.

---

## Phase 1 목표 요약

SWS Holdings 페이지와 비교 분석 결과 아래 5가지 개선을 진행한다.

---

## 개선 1: 2단 레이아웃 — 차트가 최상단에

### 현재 구조 (단일 컬럼 세로 스택)
```
[Hero Strip 카드]
[오늘의 판단]
[순자산 추이 차트] (full width)
[포트폴리오 수익률 차트] (full width)
[보유 종목 테이블]
[종목별 수익률 바 차트]
[대출 현황]
[최근 활동]
```

### 목표 구조 (SWS 스타일 2단)
```
┌─────────────────────────────┬──────────────────┐
│  포트폴리오 성과 차트 (60%)  │  요약 패널 (40%) │
│  [PortfolioPerformanceChart] │  총 평가금액      │
│  시간 범위 토글               │  총 수익률 (PnL)  │
│                              │  Alpha / 벤치     │
│  순자산 추이 차트             │  USD/KRW          │
│  [NetWorthHistoryChart]      │                   │
└─────────────────────────────┴──────────────────┘
[수평 메트릭 스트립: 총평가 | 수익 | 수익률 | Alpha | USD/KRW]
[오늘의 판단]
[보유 종목 테이블]
[종목별 수익률 바 차트]
[대출 현황]
[최근 활동]
```

### 구현 방법

`src/app/DashboardClient.tsx`의 메인 return 블록에서 최상단 레이아웃을 변경한다.

**현재 최상단 (변경 전):**
```tsx
<div className="space-y-4">
  <HeroStrip ... />
  <DecisionPanel ... />
  <NetWorthHistoryChart ... />
  <PortfolioPerformanceChart ... />
  ...
```

**목표 레이아웃 (변경 후):**
```tsx
<div className="space-y-4">
  {/* 1. 2단 차트 섹션 */}
  <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 items-start">
    {/* 왼쪽: 차트 2개 세로 */}
    <div className="space-y-4">
      <PortfolioPerformanceChart ... />
      <NetWorthHistoryChart ... />
    </div>
    {/* 오른쪽: 요약 패널 */}
    <SummaryPanel summary={summary} baseCurrency={baseCurrency} fxRates={fxRates} />
  </div>

  {/* 2. 수평 메트릭 스트립 */}
  <MetricsStrip summary={summary} />

  {/* 3. 판단 패널 */}
  <DecisionPanel holdings={holdings} />

  {/* 4. 보유 종목 테이블 */}
  ...

  {/* 5. 종목별 수익률 + 대출 */}
  ...

  {/* 6. 시그널 + 활동 */}
  ...
</div>
```

### SummaryPanel 서브 컴포넌트 (DashboardClient.tsx 하단에 추가)

```tsx
function SummaryPanel({
  summary,
  baseCurrency,
  fxRates,
}: {
  summary: Summary;
  baseCurrency: BaseCurrency;
  fxRates: FxRates;
}) {
  const isPos = summary.totalReturnRate >= 0;
  const pnlKRW = summary.totalEvalKRW - summary.totalCostKRW;

  const rows = [
    {
      label: "총 평가",
      value: formatMoney(summary.totalEvalKRW, "KRW", baseCurrency, fxRates),
      cls: "text-text-primary text-xl font-bold",
    },
    {
      label: "총 수익",
      value: `${pnlKRW >= 0 ? "+" : ""}${formatMoney(Math.abs(pnlKRW), "KRW", baseCurrency, fxRates)}`,
      cls: pnlKRW >= 0 ? "text-profit-400 text-lg font-semibold" : "text-loss-400 text-lg font-semibold",
    },
    {
      label: "수익률",
      value: `${isPos ? "+" : ""}${summary.totalReturnRate.toFixed(2)}%`,
      cls: isPos ? "text-profit-400 text-base font-semibold" : "text-loss-400 text-base font-semibold",
    },
  ];

  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-5 space-y-5">
      {rows.map((r) => (
        <div key={r.label}>
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{r.label}</p>
          <p className={r.cls}>{r.value}</p>
        </div>
      ))}
      <div className="border-t border-border-default pt-4 space-y-3">
        {summary.alpha !== null && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-text-muted">Alpha (vs KODEX 200)</span>
            <span className={`text-sm font-semibold ${summary.alpha >= 0 ? "text-profit-400" : "text-loss-400"}`}>
              {summary.alpha >= 0 ? "+" : ""}{summary.alpha.toFixed(2)}%
            </span>
          </div>
        )}
        {summary.benchmarkReturn !== null && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-text-muted">벤치 (KODEX 200)</span>
            <span className="text-sm text-text-secondary">
              {summary.benchmarkReturn >= 0 ? "+" : ""}{summary.benchmarkReturn.toFixed(2)}%
            </span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-xs text-text-muted">USD/KRW</span>
          <span className="text-sm text-text-secondary">
            {summary.usdKrw.toLocaleString()}
            {summary.fxDate && <span className="text-text-muted ml-1 text-xs">{summary.fxDate.slice(5)}</span>}
          </span>
        </div>
      </div>
    </div>
  );
}
```

### MetricsStrip 서브 컴포넌트 (DashboardClient.tsx 하단에 추가)

```tsx
function MetricsStrip({ summary }: { summary: Summary }) {
  const pnlKRW = summary.totalEvalKRW - summary.totalCostKRW;
  const isPos = summary.totalReturnRate >= 0;

  const metrics = [
    {
      label: "총 평가",
      value: formatKRW(summary.totalEvalKRW),
      cls: "text-text-primary",
    },
    {
      label: "수익/손실",
      value: `${pnlKRW >= 0 ? "+" : ""}${formatKRW(pnlKRW)}`,
      cls: pnlKRW >= 0 ? "text-profit-400" : "text-loss-400",
    },
    {
      label: "수익률",
      value: `${isPos ? "+" : ""}${summary.totalReturnRate.toFixed(2)}%`,
      cls: isPos ? "text-profit-400" : "text-loss-400",
    },
    ...(summary.alpha !== null ? [{
      label: "Alpha",
      value: `${summary.alpha >= 0 ? "+" : ""}${summary.alpha.toFixed(2)}%`,
      cls: summary.alpha >= 0 ? "text-profit-400" : "text-loss-400",
    }] : []),
    {
      label: "Core / Satellite",
      value: `${summary.totalEvalKRW > 0 ? ((summary.coreKRW / summary.totalEvalKRW) * 100).toFixed(0) : 0}% / ${summary.totalEvalKRW > 0 ? ((summary.satelliteKRW / summary.totalEvalKRW) * 100).toFixed(0) : 0}%`,
      cls: "text-text-secondary",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {metrics.map((m) => (
        <div key={m.label} className="bg-bg-surface border border-border-default rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">{m.label}</p>
          <p className={`text-sm font-semibold ${m.cls}`}>{m.value}</p>
        </div>
      ))}
    </div>
  );
}
```

### 기존 HeroStrip 처리

기존 `HeroStrip` 함수와 그 JSX (`<HeroStrip ... />`)를 **삭제**한다.  
표시하던 정보는 `SummaryPanel` + `MetricsStrip`이 대체한다.

---

## 개선 2: Holdings 테이블에 비중% 컬럼 추가

### 현재 컬럼
```
종목 | 수량 | 단가 | 현재 | 평가 | 수익 | 수익률
```

### 목표 컬럼 (SWS 스타일)
```
종목 | 비중% | 수량 | 현재 | 평가금액 | 수익 | 수익률
```

변경 내용:
- `단가(avgPrice)` 컬럼 제거 (공간 절약, 정보는 SummaryPanel에서 참조 가능)
- `비중%` 컬럼 추가 — contribData의 weightPct를 ticker 기준으로 매핑
- 정렬: evalAmountKRW 내림차순 (현재 보유 비중 큰 순)
- 모바일에서 비중%는 숨김 (`hidden sm:table-cell`)

### DashboardClient 변경

**1. Holding 인터페이스에 weightPct 추가:**
```tsx
interface Holding {
  // ... 기존 필드 유지
  weightPct: number;  // ← 추가
}
```

**2. holdings 배열에 weightPct 주입:**

`DashboardClient`의 props 인터페이스에서 `holdings`와 `contribData`를 받으므로,  
렌더링 시점에 merge한다:

```tsx
// 컴포넌트 시작 부분에 추가
const weightMap = new Map(contribData.map((c) => [c.ticker, c.weightPct]));
const holdingsSorted = [...holdings]
  .map((h) => ({ ...h, weightPct: weightMap.get(h.ticker) ?? 0 }))
  .sort((a, b) => b.evalAmountKRW - a.evalAmountKRW);
```

이후 테이블에서 `holdings` 대신 `holdingsSorted`를 사용.

**3. 테이블 헤더 변경:**
```tsx
<tr>
  <th className="text-left px-3 py-2 font-medium text-text-muted text-xs uppercase">종목</th>
  <th className="text-right px-2 py-2 font-medium text-text-muted text-xs uppercase hidden sm:table-cell">비중%</th>
  <th className="text-right px-2 py-2 font-medium text-text-muted text-xs uppercase hidden sm:table-cell">수량</th>
  <th className="text-right px-2 py-2 font-medium text-text-muted text-xs uppercase">현재가</th>
  <th className="text-right px-2 py-2 font-medium text-text-muted text-xs uppercase">평가금액</th>
  <th className="text-right px-2 py-2 font-medium text-text-muted text-xs uppercase hidden md:table-cell">수익</th>
  <th className="text-right px-3 py-2 font-medium text-text-muted text-xs uppercase">수익률</th>
</tr>
```

**4. 테이블 행 변경:**
```tsx
{holdingsSorted.map((h, i) => {
  const pos = h.returnRate >= 0;
  const fmtPrice = (p: number) =>
    h.currency === "USD" ? `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `₩${p.toLocaleString()}`;

  return (
    <tr key={h.ticker} className={`border-b border-border-default/30 hover:bg-bg-elevated/25 transition-colors ${i === holdingsSorted.length - 1 ? "border-0" : ""}`}>
      {/* 종목 */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <StockIdentity ticker={h.ticker} name={h.name} market={h.market} />
        </div>
      </td>
      {/* 비중% */}
      <td className="px-2 py-3 text-right hidden sm:table-cell">
        <span className="text-sm text-text-secondary">{h.weightPct.toFixed(1)}%</span>
      </td>
      {/* 수량 */}
      <td className="px-2 py-3 text-right hidden sm:table-cell">
        <span className="text-sm text-text-secondary">{h.quantity.toLocaleString()}</span>
      </td>
      {/* 현재가 */}
      <td className="px-2 py-3 text-right">
        <span className="text-sm text-text-primary font-medium">{fmtPrice(h.currentPrice)}</span>
      </td>
      {/* 평가금액 */}
      <td className="px-2 py-3 text-right">
        <span className="text-sm text-text-primary">{formatKRW(h.evalAmountKRW)}</span>
      </td>
      {/* 수익 */}
      <td className="px-2 py-3 text-right hidden md:table-cell">
        <span className={`text-sm font-medium ${pos ? "text-profit-400" : "text-loss-400"}`}>
          {pos ? "+" : ""}{formatKRW(h.evalAmountKRW - h.costAmountKRW)}
        </span>
      </td>
      {/* 수익률 */}
      <td className="px-3 py-3 text-right">
        <span className={`inline-block text-xs font-bold px-2 py-1 rounded-md ${pos ? "bg-profit-bg text-profit-400" : "bg-loss-bg text-loss-400"}`}>
          {pos ? "+" : ""}{h.returnRate.toFixed(2)}%
        </span>
      </td>
    </tr>
  );
})}
```

---

## 개선 3: 시간 범위 토글 — 7D·YTD 추가

### 대상 컴포넌트

`src/components/NetWorthHistoryChart.tsx`와 `src/components/PortfolioPerformanceChart.tsx`

### 현재 범위 옵션
```tsx
const RANGES = ["1M", "3M", "6M", "1Y", "ALL"] as const;
```

### 변경 후 (SWS와 동일)
```tsx
const RANGES = ["7D", "1M", "3M", "YTD", "1Y", "ALL"] as const;
```

### 7D / YTD 필터링 로직 추가

두 차트 컴포넌트에서 `range` 기반 필터링 부분을 찾아 케이스를 추가:

```tsx
case "7D": {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  filtered = allData.filter((d) => new Date(d.date) >= cutoff);
  break;
}
case "YTD": {
  const jan1 = new Date(new Date().getFullYear(), 0, 1);
  filtered = allData.filter((d) => new Date(d.date) >= jan1);
  break;
}
```

각 컴포넌트의 구체적인 필터 로직은 파일을 열어 확인 후 동일한 패턴으로 추가.

---

## 개선 4: Holdings 테이블 헤더 섹션 (SWS 스타일)

SWS는 Holdings 테이블 위에 `Holdings 1` 형태로 보유 종목 수를 표시한다.

### 현재
```tsx
<h2 className="text-sm font-semibold ...">보유 종목</h2>
```

### 변경 후
```tsx
<div className="flex items-center justify-between mb-3">
  <div className="flex items-center gap-2">
    <h2 className="text-sm font-semibold text-text-primary">보유 종목</h2>
    <span className="text-xs text-text-muted bg-bg-elevated px-2 py-0.5 rounded-full">
      {holdings.length}
    </span>
  </div>
  <Link
    href="/portfolio/returns"
    className="text-xs text-brand-green hover:underline"
  >
    수익률 분석 →
  </Link>
</div>
```

---

## 개선 5: 차트 카드 스타일 통일 (SWS 스타일)

현재 각 차트 카드가 서로 다른 패딩/스타일을 사용할 수 있음.  
두 차트 컴포넌트(`NetWorthHistoryChart`, `PortfolioPerformanceChart`)의 최외곽 래퍼를 통일:

```tsx
// 각 차트의 최외곽 div (파일 열어 확인 후 적용)
<div className="bg-bg-surface border border-border-default rounded-xl overflow-hidden">
  {/* 차트 헤더 */}
  <div className="px-5 pt-4 pb-2 flex items-center justify-between">
    <div>
      <h3 className="text-sm font-semibold text-text-primary">차트 제목</h3>
      <p className="text-xs text-text-muted">부제목</p>
    </div>
    {/* 시간 범위 토글 */}
    <div className="flex gap-1">
      {RANGES.map(...)}
    </div>
  </div>
  {/* 차트 본체 */}
  <div className="px-4 pb-4">
    <RechartComponent ... />
  </div>
</div>
```

---

## 구현 순서 권장

1. **개선 2** (Holdings 테이블 weightPct + 정렬) — 가장 독립적, 먼저 완성
2. **개선 3** (7D 토글) — 각 차트 파일 수정, 독립적
3. **개선 1** (2단 레이아웃 + SummaryPanel + MetricsStrip + HeroStrip 제거) — 핵심 레이아웃 변경
4. **개선 4** (테이블 헤더) — 개선 2 완료 후
5. **개선 5** (차트 카드 스타일) — 마지막

---

## 삭제 목록

- `HeroStrip` 함수 및 호출부 → 삭제 (SummaryPanel + MetricsStrip으로 대체)

## 유지 목록 (삭제 금지)

- `DecisionPanel` 함수 — 유지, 레이아웃에서 MetricsStrip 아래로 이동
- `LoanPanel` 함수 — 유지
- `ReturnBarChart` 사용부 — 유지 (Holdings 하단)
- `ActivityTimeline` — 유지

---

## 완료 체크리스트 — Phase 1

- [ ] 개선 2: weightPct 컬럼 + evalAmountKRW 기준 정렬
- [ ] 개선 3: 7D·YTD 시간 범위 두 차트에 추가
- [ ] 개선 1: 2단 레이아웃 (lg:grid-cols-[3fr_2fr])
- [ ] 개선 1: SummaryPanel 서브컴포넌트 구현
- [ ] 개선 1: MetricsStrip 서브컴포넌트 구현
- [ ] 개선 1: HeroStrip 제거
- [ ] 개선 4: 테이블 헤더 보유 종목 수 + 링크
- [ ] 개선 5: 차트 카드 스타일 통일

---

---

# Phase 2: Research → Holdings 연결 (GSF 차별화)

## 배경

현재 `DecisionPanel`은 하드코딩된 데이터를 사용한다 (`DashboardClient.tsx` L349).  
Phase 2는 이 데이터를 DB로 이관하고, Holdings 테이블에 **Fair Value · Conviction · Next Catalyst** 컬럼을 추가한다.

### 목표 Holdings 테이블 (Phase 2 완료 후)
```
종목 | 비중% | 현재가 | 평가금액 | 수익률 | 목표가(Upside) | Conviction | Next Catalyst
```

---

## Phase 2-A: DB 스키마 추가

### 1. `schema.ts`에 `stockThesis` 테이블 추가

파일: `src/db/schema.ts`

기존 exports 위, `holdingSnapshots` 테이블 다음에 추가:

```ts
// ── 종목 투자 논거 (Research → Holdings 연결) ─────────────────────────────
export const stockThesis = sqliteTable("stock_thesis", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stockId: integer("stock_id").references(() => stocks.id).notNull(),
  action: text("action").notNull().default("관찰"), // '보유' | '매수' | '매도' | '관찰'
  conviction: text("conviction").default("Low"),    // 'High' | 'Mid' | 'Low'
  fairValueLocal: real("fair_value_local"),          // 목표 주가 (현지 통화 기준)
  expectedReturnPct: real("expected_return_pct"),    // 기대 수익률 %
  nextCatalyst: text("next_catalyst"),               // 다음 이벤트/카탈리스트
  thesisSummary: text("thesis_summary"),             // 투자 논거 요약 (선택)
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (t) => [
  uniqueIndex("uq_stock_thesis").on(t.stockId),     // 종목당 1개
]);

export type StockThesis = typeof stockThesis.$inferSelect;
export type NewStockThesis = typeof stockThesis.$inferInsert;
```

### 2. 마이그레이션 SQL 파일 생성

파일: `drizzle/0002_stock_thesis.sql`

```sql
CREATE TABLE `stock_thesis` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `stock_id` integer NOT NULL,
  `action` text NOT NULL DEFAULT '관찰',
  `conviction` text DEFAULT 'Low',
  `fair_value_local` real,
  `expected_return_pct` real,
  `next_catalyst` text,
  `thesis_summary` text,
  `updated_at` text DEFAULT (datetime('now')),
  FOREIGN KEY (`stock_id`) REFERENCES `stocks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_stock_thesis` ON `stock_thesis` (`stock_id`);
--> statement-breakpoint
-- 기존 하드코딩 데이터 마이그레이션 (동서 026960)
INSERT INTO `stock_thesis` (`stock_id`, `action`, `conviction`, `expected_return_pct`, `next_catalyst`, `thesis_summary`)
SELECT s.id, '보유', 'Mid', 29.7,
  '8월 반기보고서 대기 · S8 이격 +7%',
  '저평가 가치주 + 동서식품 지분 이벤트 드리븐. PBR<1, 배당수익률 3%+'
FROM stocks s WHERE s.ticker = '026960';
```

### 3. 마이그레이션 실행

```bash
npm run db:migrate
```

---

## Phase 2-B: Holdings 테이블에 Research 컬럼 추가

### holdings/page.tsx 데이터 쿼리 추가

`src/app/portfolio/holdings/page.tsx`의 `fetchDashboardData()` 함수에 thesis 데이터 쿼리 추가:

```ts
// fetchDashboardData() 내부, portfolioRows 쿼리 다음에 추가
const thesisRows = await db.run(sql`
  SELECT
    st.stock_id,
    st.action,
    st.conviction,
    st.fair_value_local,
    st.expected_return_pct,
    st.next_catalyst
  FROM stock_thesis st
`);

const thesisMap = new Map(
  thesisRows.rows.map((r) => [
    Number(r[0]),
    {
      action: String(r[1]),
      conviction: r[2] ? String(r[2]) : null,
      fairValueLocal: r[3] != null ? Number(r[3]) : null,
      expectedReturnPct: r[4] != null ? Number(r[4]) : null,
      nextCatalyst: r[5] ? String(r[5]) : null,
    },
  ])
);
```

holdings 배열 map에서 thesis 데이터 추가:

```ts
// holdings.map() 내부, returnRate 계산 다음에 추가
const thesis = thesisMap.get(stockId) ?? null;

return {
  // ... 기존 필드
  thesis,  // ← 추가
};
```

### Holding 인터페이스 확장 (DashboardClient.tsx)

```tsx
interface ThesisData {
  action: string;
  conviction: string | null;
  fairValueLocal: number | null;
  expectedReturnPct: number | null;
  nextCatalyst: string | null;
}

interface Holding {
  // ... 기존 필드
  thesis: ThesisData | null;  // ← 추가
}
```

### Holdings 테이블에 컬럼 추가

테이블 헤더에 추가 (모바일에서는 숨김):

```tsx
<th className="text-right px-2 py-2 font-medium text-text-muted text-xs uppercase hidden lg:table-cell">목표가</th>
<th className="text-center px-2 py-2 font-medium text-text-muted text-xs uppercase hidden lg:table-cell">Conviction</th>
<th className="text-left px-2 py-2 font-medium text-text-muted text-xs uppercase hidden xl:table-cell">Next</th>
```

테이블 행에 추가:

```tsx
{/* 목표가 */}
<td className="px-2 py-3 text-right hidden lg:table-cell">
  {h.thesis?.fairValueLocal ? (
    <div>
      <p className="text-sm text-text-primary">
        {h.currency === "USD"
          ? `$${h.thesis.fairValueLocal.toLocaleString()}`
          : `₩${h.thesis.fairValueLocal.toLocaleString()}`}
      </p>
      {h.thesis.expectedReturnPct != null && (
        <p className={`text-xs font-medium mt-0.5 ${h.thesis.expectedReturnPct >= 0 ? "text-profit-400" : "text-loss-400"}`}>
          {h.thesis.expectedReturnPct >= 0 ? "+" : ""}{h.thesis.expectedReturnPct.toFixed(1)}%
        </p>
      )}
    </div>
  ) : (
    <span className="text-xs text-text-muted">—</span>
  )}
</td>

{/* Conviction */}
<td className="px-2 py-3 text-center hidden lg:table-cell">
  {h.thesis?.conviction ? (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
      h.thesis.conviction === "High"
        ? "bg-profit-bg text-profit-400"
        : h.thesis.conviction === "Mid"
          ? "bg-brand-green/10 text-brand-green"
          : "bg-bg-elevated text-text-muted"
    }`}>
      {h.thesis.conviction}
    </span>
  ) : (
    <span className="text-xs text-text-muted">—</span>
  )}
</td>

{/* Next Catalyst */}
<td className="px-2 py-3 hidden xl:table-cell">
  <span className="text-xs text-text-secondary line-clamp-1">
    {h.thesis?.nextCatalyst ?? "—"}
  </span>
</td>
```

---

## Phase 2-C: DecisionPanel DB 연동

`DashboardClient.tsx`의 `DecisionPanel` 함수에서 하드코딩 제거:

**현재 (하드코딩):**
```tsx
const decisions: Record<string, ...> = {
  "026960": { action: "보유", conviction: "Mid", note: "..." },
  ...
};
```

**변경 후 (thesis prop 사용):**
```tsx
function DecisionPanel({ holdings }: { holdings: Holding[] }) {
  const withThesis = holdings.filter(
    (h) => h.thesis && h.thesis.action && h.thesis.action !== "관찰"
  );

  if (withThesis.length === 0) return null;

  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand-green animate-pulse" />
          오늘의 판단
        </h2>
        <span className="text-xs text-text-muted">리서치 프레임워크 연동</span>
      </div>
      {withThesis.map((h) => (
        <div key={h.ticker} className="flex items-center gap-3 py-2 border-b border-border-default/40 last:border-0">
          <div className="w-20 shrink-0">
            <p className="text-sm font-medium text-text-primary">{h.name}</p>
            <p className="text-xs text-text-muted">{h.ticker}</p>
          </div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
            h.thesis!.action === "매수" ? "bg-profit-bg text-profit-400" :
            h.thesis!.action === "매도" ? "bg-loss-bg text-loss-400" :
            "bg-brand-green/10 text-brand-green"
          }`}>
            {h.thesis!.action}
          </span>
          <p className="text-xs text-text-secondary flex-1 min-w-0 line-clamp-1">
            {h.thesis?.nextCatalyst ?? ""}
          </p>
          {h.thesis?.conviction && (
            <span className="text-xs text-text-muted shrink-0">
              Conviction: {h.thesis.conviction}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## Phase 2-D: `/research/[ticker]` 편집 폼

현재 `/research/[ticker]/page.tsx`는 플레이스홀더임.  
이것을 **thesis 데이터 조회 + 편집 폼**으로 교체한다.

### page.tsx (Server Component)

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import AppPageLayout from "@/components/AppPageLayout";
import ResearchTickerClient from "./ResearchTickerClient";

export default async function ResearchTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const { ticker } = await params;

  const stockRow = await db.run(sql`
    SELECT s.id, s.name, s.market, s.category
    FROM stocks s WHERE s.ticker = ${ticker.toUpperCase()}
    LIMIT 1
  `);
  if (!stockRow.rows.length) return <div>종목 없음</div>;

  const [stockId, name, market, category] = stockRow.rows[0];

  const thesisRow = await db.run(sql`
    SELECT action, conviction, fair_value_local, expected_return_pct, next_catalyst, thesis_summary
    FROM stock_thesis WHERE stock_id = ${Number(stockId)}
    LIMIT 1
  `);

  const thesis = thesisRow.rows.length
    ? {
        action: String(thesisRow.rows[0][0]),
        conviction: thesisRow.rows[0][1] ? String(thesisRow.rows[0][1]) : "",
        fairValueLocal: thesisRow.rows[0][2] != null ? Number(thesisRow.rows[0][2]) : null,
        expectedReturnPct: thesisRow.rows[0][3] != null ? Number(thesisRow.rows[0][3]) : null,
        nextCatalyst: thesisRow.rows[0][4] ? String(thesisRow.rows[0][4]) : "",
        thesisSummary: thesisRow.rows[0][5] ? String(thesisRow.rows[0][5]) : "",
      }
    : null;

  return (
    <AppPageLayout
      email={session.user?.email}
      title={`${ticker.toUpperCase()} — ${String(name)}`}
      subtitle={`${String(market)} · ${String(category)}`}
    >
      <ResearchTickerClient
        ticker={ticker.toUpperCase()}
        stockId={Number(stockId)}
        initialThesis={thesis}
      />
    </AppPageLayout>
  );
}
```

### ResearchTickerClient.tsx (Client Component)

```tsx
"use client";

import { useState } from "react";
import { inputClass, btnPrimary, btnPrimarySm } from "@/lib/economist-ui";

interface ThesisForm {
  action: string;
  conviction: string;
  fairValueLocal: string;
  expectedReturnPct: string;
  nextCatalyst: string;
  thesisSummary: string;
}

export default function ResearchTickerClient({
  ticker,
  stockId,
  initialThesis,
}: {
  ticker: string;
  stockId: number;
  initialThesis: {
    action: string; conviction: string;
    fairValueLocal: number | null; expectedReturnPct: number | null;
    nextCatalyst: string; thesisSummary: string;
  } | null;
}) {
  const [form, setForm] = useState<ThesisForm>({
    action: initialThesis?.action ?? "관찰",
    conviction: initialThesis?.conviction ?? "Low",
    fairValueLocal: initialThesis?.fairValueLocal?.toString() ?? "",
    expectedReturnPct: initialThesis?.expectedReturnPct?.toString() ?? "",
    nextCatalyst: initialThesis?.nextCatalyst ?? "",
    thesisSummary: initialThesis?.thesisSummary ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/research/thesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockId,
          action: form.action,
          conviction: form.conviction || null,
          fairValueLocal: form.fairValueLocal ? parseFloat(form.fairValueLocal) : null,
          expectedReturnPct: form.expectedReturnPct ? parseFloat(form.expectedReturnPct) : null,
          nextCatalyst: form.nextCatalyst || null,
          thesisSummary: form.thesisSummary || null,
        }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, name, type = "text", placeholder = "" }: {
    label: string; name: keyof ThesisForm; type?: string; placeholder?: string;
  }) => (
    <div>
      <label className="block text-xs text-text-muted mb-1">{label}</label>
      <input
        type={type}
        value={form[name]}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );

  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-bg-surface border border-border-default rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">투자 판단</h2>

        {/* Action */}
        <div>
          <label className="block text-xs text-text-muted mb-1">Action</label>
          <div className="flex gap-2">
            {["보유", "매수", "매도", "관찰"].map((a) => (
              <button
                key={a}
                onClick={() => setForm((f) => ({ ...f, action: a }))}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                  form.action === a
                    ? "bg-brand-green border-brand-green text-white font-semibold"
                    : "border-border-strong text-text-secondary hover:border-brand-green/40"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Conviction */}
        <div>
          <label className="block text-xs text-text-muted mb-1">Conviction</label>
          <div className="flex gap-2">
            {["High", "Mid", "Low"].map((c) => (
              <button
                key={c}
                onClick={() => setForm((f) => ({ ...f, conviction: c }))}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                  form.conviction === c
                    ? "bg-brand-green/15 border-brand-green text-brand-green font-semibold"
                    : "border-border-strong text-text-secondary hover:border-brand-green/40"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="목표 주가 (현지 통화)" name="fairValueLocal" type="number" placeholder="35000" />
          <Field label="기대 수익률 (%)" name="expectedReturnPct" type="number" placeholder="29.7" />
        </div>

        <Field label="Next Catalyst" name="nextCatalyst" placeholder="8월 반기보고서 · 배당락일 등" />

        <div>
          <label className="block text-xs text-text-muted mb-1">투자 논거 요약</label>
          <textarea
            value={form.thesisSummary}
            onChange={(e) => setForm((f) => ({ ...f, thesisSummary: e.target.value }))}
            rows={3}
            placeholder="저평가 가치주 + 지분 이벤트 드리븐..."
            className={`${inputClass} resize-none`}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={`${btnPrimarySm} w-full`}
        >
          {saving ? "저장 중..." : saved ? "저장됨 ✓" : "저장"}
        </button>
      </div>
    </div>
  );
}
```

### API Route: `/api/research/thesis`

파일: `src/app/api/research/thesis/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { stockId, action, conviction, fairValueLocal, expectedReturnPct, nextCatalyst, thesisSummary } = body;

  if (!stockId || !action) {
    return NextResponse.json({ error: "stockId and action required" }, { status: 400 });
  }

  await db.run(sql`
    INSERT INTO stock_thesis (stock_id, action, conviction, fair_value_local, expected_return_pct, next_catalyst, thesis_summary, updated_at)
    VALUES (${stockId}, ${action}, ${conviction ?? null}, ${fairValueLocal ?? null}, ${expectedReturnPct ?? null}, ${nextCatalyst ?? null}, ${thesisSummary ?? null}, datetime('now'))
    ON CONFLICT(stock_id) DO UPDATE SET
      action = excluded.action,
      conviction = excluded.conviction,
      fair_value_local = excluded.fair_value_local,
      expected_return_pct = excluded.expected_return_pct,
      next_catalyst = excluded.next_catalyst,
      thesis_summary = excluded.thesis_summary,
      updated_at = excluded.updated_at
  `);

  return NextResponse.json({ ok: true });
}
```

---

## Phase 2 완료 체크리스트

- [ ] `src/db/schema.ts` — `stockThesis` 테이블 추가 및 타입 export
- [ ] `drizzle/0002_stock_thesis.sql` — 마이그레이션 파일 생성
- [ ] `npm run db:migrate` — 마이그레이션 실행 (Turso/libsql 대상)
- [ ] `holdings/page.tsx` — thesis 데이터 쿼리 추가
- [ ] `DashboardClient.tsx` — Holding 인터페이스 thesis 필드 추가
- [ ] Holdings 테이블 — 목표가·Conviction·Next Catalyst 컬럼 추가
- [ ] DecisionPanel — 하드코딩 제거, thesis prop 사용
- [ ] `/research/[ticker]/page.tsx` — 플레이스홀더 → 실제 폼으로 교체
- [ ] `ResearchTickerClient.tsx` — 편집 폼 구현
- [ ] `src/app/api/research/thesis/route.ts` — UPSERT API 구현

---

## 전체 완료 체크리스트

### Phase 1
- [ ] 개선 2: weightPct 컬럼 + evalAmountKRW 기준 정렬
- [ ] 개선 3: 7D·YTD 시간 범위 두 차트에 추가
- [ ] 개선 1: 2단 레이아웃 (lg:grid-cols-[3fr_2fr])
- [ ] 개선 1: SummaryPanel + MetricsStrip 구현 + HeroStrip 제거
- [ ] 개선 4: 테이블 헤더 보유 종목 수 + 링크
- [ ] 개선 5: 차트 카드 스타일 통일

### Phase 2
- [ ] DB 스키마 + 마이그레이션
- [ ] Holdings 테이블 Research 컬럼 3개
- [ ] DecisionPanel DB 연동
- [ ] `/research/[ticker]` 편집 폼 + API

### 공통
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run build` — 성공

---

## 검증 포인트 (Claude 담당)

### Phase 1
1. **비중% 합계**: 모든 보유 종목의 비중% 합계가 ~100%인지 확인
2. **정렬**: 가장 큰 평가금액 종목이 테이블 첫 행인지 확인
3. **2단 레이아웃**: `lg:` 브레이크포인트에서 차트+패널이 나란히 표시되는지 확인
4. **7D·YTD 토글**: 클릭 시 해당 기간 데이터만 표시되는지 확인
5. **HeroStrip 제거**: 기존 Hero Strip 카드가 더 이상 렌더링되지 않는지 확인

### Phase 2
6. **Holdings 목표가**: 동서(026960)에 ₩35,000 (또는 입력값) 표시 확인
7. **Conviction 뱃지**: Mid = 그린 뱃지로 표시 확인
8. **Next Catalyst**: "8월 반기보고서 대기..." 텍스트 표시 확인
9. **Research 폼**: `/research/026960` 접근 시 편집 폼 표시, 저장 후 Holdings 반영
10. **마이그레이션**: `npm run db:migrate` 오류 없이 완료 확인
