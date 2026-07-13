# GSF-Investor UI Design Refresh — 작업지시서 v1.0

**작성일**: 2026-07-13  
**브랜치**: `feature/ui-design-refresh` (main에서 새 브랜치 생성 후 작업)  
**대상 앱**: `/Users/gsf/dev/Cursor/gsf-investor` (Next.js App Router, Tailwind v4, Drizzle ORM, Turso/libsql)

---

## 0. 핵심 원칙

1. **숫자 > 라벨**: 숫자는 크게, 라벨은 작고 옅게. Economist 스타일.
2. **레이아웃 순서**: Hero(총자산) → Decision Panel → 포트폴리오 테이블 → 차트 분석 → 세부정보
3. **도넛 차트 제거**: Core/Sat 도넛, 비중 도넛, 섹터 도넛 3종 전부 삭제. 수익률 막대차트만 유지.
4. **단일 대형 차트**: 자산 추이 차트(NetWorthHistoryChart) 하나만 대형으로 상단에 표시.
5. **색상 개선**: 더 따뜻하고 선명한 톤으로 업그레이드.
6. **반경 6-8px**: 현재 0px인 radius를 6-8px로 교체.

---

## 1. 색상 토큰 변경 — `src/app/globals.css`

**Light mode 변경 사항** (`:root` 및 `:root[data-theme="light"]` 두 블록 모두 동일하게 적용):

| 토큰 | 현재 값 | 새 값 | 비고 |
|------|---------|-------|------|
| `--bg-base` | `#F9F8F6` | `#F7F4EE` | Warm Ivory |
| `--bg-surface` | `#F2EFEA` | `#FFFFFF` | 카드 순백 |
| `--bg-elevated` | `#EBE7E0` | `#F2EFE9` | 살짝 따뜻한 엘리베이션 |
| `--bg-overlay` | `#F2EFEA` | `#FFFFFF` | |
| `--border-default` | `#D4CFC5` | `#E7E3DA` | 더 연하게 |
| `--border-subtle` | `#E3DDD3` | `#EDE9E2` | |
| `--border-strong` | `#A39E96` | `#C5BFB3` | |
| `--text-primary` | `#1F1E1D` | `#1C1C1C` | |
| `--text-secondary` | `#54524F` | `#555555` | |
| `--text-muted` | `#85827E` | `#888888` | |
| `--brand-green` | `#2E633F` | `#355E4B` | 더 깊은 포레스트 |
| `--profit-500` | `#3A4D39` | `#1F6B3B` | 선명한 그린 |
| `--profit-400` | `#4A6149` | `#2E8B57` | Sea Green |
| `--profit-bg` | `rgba(58,77,57,0.06)` | `rgba(46,139,87,0.08)` | |
| `--profit-border` | `rgba(58,77,57,0.15)` | `rgba(46,139,87,0.20)` | |
| `--loss-500` | `#8C3A35` | `#B33A2A` | 더 선명한 적색 |
| `--loss-400` | `#A64842` | `#C24D3A` | Terracotta |
| `--loss-bg` | `rgba(140,58,53,0.06)` | `rgba(194,77,58,0.08)` | |
| `--loss-border` | `rgba(140,58,53,0.15)` | `rgba(194,77,58,0.20)` | |

**radius 변경** (`@theme` 블록):

| 토큰 | 현재 | 새 값 |
|------|------|-------|
| `--radius-sm` | `0px` | `4px` |
| `--radius-md` | `0px` | `6px` |
| `--radius-lg` | `2px` | `8px` |
| `--radius-xl` | `4px` | `10px` |
| `--radius-2xl` | `4px` | `12px` |

**Dark mode는 건드리지 않음.** (`:root[data-theme="dark"]` 및 `@media prefers-color-scheme: dark` 블록 유지)

---

## 2. economist-ui.ts 토큰 업데이트 — `src/lib/economist-ui.ts`

`economistCard` 토큰에서 `border-t-4 border-t-brand-green` 제거하고 subtle한 border로 통일:

```ts
// 현재:
export const economistCard =
  "bg-bg-surface border-t-4 border-t-brand-green border border-border-default rounded-sm shadow-sm";

// 변경 후:
export const economistCard =
  "bg-bg-surface border border-border-default rounded-lg shadow-sm";
```

`economistStatCard`도 동일하게:
```ts
// 변경 후:
export const economistStatCard =
  "bg-bg-surface border border-border-default rounded-lg shadow-sm p-4";
```

`rounded-sm` → `rounded-md` 로 전체 일관 적용 (inputClass, selectClass, textareaClass 포함):
```ts
export const inputClass = `w-full bg-bg-elevated border border-border-strong text-text-primary rounded-md px-3 py-2 text-sm ${inputFocus}`;
```

---

## 3. DashboardClient.tsx 전면 재구성 — `src/app/DashboardClient.tsx`

### 3-A. import 변경

제거:
```ts
import {
  ReturnBarChart,
  CoreSatelliteDonut,
  WeightDonut,        // ← 삭제
  SectorDonut,        // ← 삭제
  formatKRW,
} from "@/components/DashboardCharts";
```

변경 후:
```ts
import {
  ReturnBarChart,
  formatKRW,
} from "@/components/DashboardCharts";
```

### 3-B. 레이아웃 구조 (return 블록 전체 재작성)

아래 순서로 배치:

```
1. Hero Strip      — 총 자산 대형 숫자 + 수익률 + PnL + Alpha (가로 KPI 스트립)
2. Decision Panel  — 보유 종목별 현재 판단 (연구 프레임워크 연동)
3. NetWorthHistoryChart  — 자산 추이 대형 차트 (full-width)
4. PortfolioPerformanceChart  — 성과 차트
5. 보유 종목 테이블
6. 수익률 막대차트 (ReturnBarChart) — 1/2 width
7. 대출 현황 — 1/2 width
8. 최근 시그널 + 활동 타임라인
```

### 3-C. Hero Strip 리디자인

현재 `HeroMetric` + `MiniStat` 7개 항목을 아래처럼 재구성:

- **총 평가액**: 가장 큰 숫자 (`text-3xl sm:text-4xl font-bold`), 라벨 `text-xs text-text-muted`
- **총 수익률**: `text-2xl font-bold`, 색상 profit/loss 조건부
- **PnL**: 수익/손실 금액 `text-xl font-semibold`
- **Alpha**: `text-xl font-bold`
- **USD/KRW**: `text-base font-semibold text-text-secondary`

구조 예시:
```tsx
<div className="bg-bg-surface border border-border-default rounded-lg shadow-sm px-6 py-5">
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 lg:divide-x divide-border-default">
    <div className="lg:pr-6">
      <p className="text-xs text-text-muted mb-1 uppercase tracking-wide">총 평가</p>
      <p className="text-3xl sm:text-4xl font-bold tabular-nums text-text-primary leading-none">
        {fmt(summary.totalEvalKRW)}
      </p>
      <p className="text-xs text-text-muted mt-1">원가 {fmt(summary.totalCostKRW)}</p>
    </div>
    {/* 수익률, PnL, Alpha, USD/KRW — 각 lg:px-6 */}
  </div>
</div>
```

### 3-D. Decision Panel (신규 컴포넌트)

Hero 바로 아래, 보유 종목별 현재 판단을 표시하는 패널.
데이터 소스: `holdings` 배열 (이미 props로 전달됨). 현재는 리서치 DB 연동 없이 하드코딩 프록시로 구현.

```tsx
function DecisionPanel({ holdings }: { holdings: Holding[] }) {
  // 현재는 하드코딩 — 향후 research/DECISIONS.md 또는 DB 연동
  const decisions: Record<string, { action: string; conviction: string; note: string }> = {
    "026960": {
      action: "보유",
      conviction: "Mid",
      note: "기대수익 +29.7% · 8월 반기보고서 대기 · S8 이격 +7%",
    },
  };

  if (holdings.length === 0) return null;

  return (
    <div className="bg-bg-surface border border-border-default rounded-lg shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-border-default flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-green inline-block" />
          오늘의 판단
        </h2>
        <span className="text-xs text-text-muted">리서치 프레임워크 연동</span>
      </div>
      <div className="divide-y divide-border-default/50">
        {holdings.map((h) => {
          const d = decisions[h.ticker] ?? { action: "관찰", conviction: "—", note: "판단 미등록" };
          const actionColor =
            d.action === "매수" ? "text-profit-400 bg-profit-bg border-profit-border"
            : d.action === "매도" ? "text-loss-400 bg-loss-bg border-loss-border"
            : "text-brand-green bg-brand-green/8 border-brand-green/25";
          return (
            <div key={h.stockId} className="px-5 py-3 flex items-center gap-4">
              <div className="shrink-0">
                <p className="text-sm font-semibold text-text-primary">{h.name}</p>
                <p className="text-xs text-text-muted">{h.ticker}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold border shrink-0 ${actionColor}`}>
                {d.action}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-text-secondary truncate">{d.note}</p>
              </div>
              <span className="text-xs text-text-muted shrink-0">Conviction: {d.conviction}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

DashboardClient return 블록에 Hero 바로 다음에 삽입:
```tsx
<DecisionPanel holdings={holdings} />
```

### 3-E. 차트 섹션 재구성

**제거**: `<div className="grid grid-cols-2 xl:grid-cols-4 gap-3">` 전체 블록 (도넛 3종 포함)

**추가**: NetWorthHistoryChart + PortfolioPerformanceChart full-width로 배치 후, 그 아래 2열 그리드에 수익률 막대 + 대출:

```tsx
{/* 자산 추이 — full width */}
<NetWorthHistoryChart baseCurrency={baseCurrency} fxRates={fxRates} />

<PortfolioPerformanceChart />

{/* 수익률 막대 + 대출 — 2열 */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <div className="bg-bg-surface border border-border-default rounded-lg shadow-sm px-4 pt-4 pb-3 min-h-[240px] flex flex-col">
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="text-sm font-semibold text-text-primary">종목별 수익률</h2>
      <span className="text-xs text-text-muted">매입가 기준</span>
    </div>
    {barData.length > 0
      ? <ReturnBarChart data={barData} />
      : <EmptyState message="보유 없음" cta={{ label: "일지", href: "/journal" }} />}
  </div>
  {/* 대출 현황 — 기존 코드 이식, rounded-lg로 className 교체 */}
  <LoanPanel loans={loans} totalLoan={totalLoan} totalAnnual={totalAnnual} ltvPct={ltvPct} />
</div>
```

`LoanPanel`은 기존 대출 현황 블록을 서브 컴포넌트로 분리:

```tsx
function LoanPanel({ loans, totalLoan, totalAnnual, ltvPct }: {...}) {
  return (
    <div className="bg-bg-surface border border-border-default rounded-lg shadow-sm overflow-hidden">
      {/* 기존 대출 현황 코드 그대로, rounded-lg 적용 */}
    </div>
  );
}
```

### 3-F. 하단 — 시그널 + 타임라인

2열 유지, 단 className에서 `economistCard` 직접 쓰는 대신 인라인으로 `rounded-lg` 적용:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <ActivityTimeline items={activityItems} />
  {/* 시그널 패널 — 기존 코드, rounded-lg */}
</div>
```

---

## 4. 보유 종목 테이블 개선

**수익률 뱃지**: 현재 `rounded text-xs` → `rounded-md text-xs font-bold`

**행 구분선**: 더 연하게 (`border-border-default/30`)

**헤더 배경**: `bg-bg-elevated/60` → `bg-bg-elevated/30` (더 subtle)

---

## 5. AppPageLayout 헤더 제거

대시보드 페이지는 Hero Strip이 사실상 헤더 역할을 하므로, `page.tsx`에서 `AppPageLayout`의 title/subtitle을 제거하거나 빈 문자열로 교체.

`src/app/page.tsx` 에서:
```tsx
// 현재:
<AppPageLayout title="포트폴리오 대시보드" subtitle="...">

// 변경 후:
<AppPageLayout title="" subtitle="">
```

또는 AppPageLayout의 title이 비어있을 때 헤더 div를 렌더하지 않도록 수정:
```tsx
// AppPageLayout.tsx에서:
{title && (
  <div>
    <h1 className={pageTitle}>{title}</h1>
    {subtitle && <p className={pageSubtitle}>{subtitle}</p>}
  </div>
)}
```

---

## 6. DashboardCharts.tsx — 도넛 관련 코드 정리

`CoreSatelliteDonut`, `WeightDonut`, `SectorDonut` 함수는 DashboardClient에서 더 이상 import하지 않으므로, 해당 함수들을 파일에서 삭제 (또는 `export` 제거). 단, `ReturnBarChart`와 `formatKRW`는 유지.

삭제 대상 함수:
- `CoreSatelliteDonut`
- `WeightDonut`  
- `SectorDonut`
- `DONUT_CORE_COLORS` 상수 (도넛 전용이므로)
- `SECTOR_COLORS` 상수 (섹터 도넛 전용)
- `CHART_FOOTER_H` 상수 (도넛 레이아웃 전용)

유지:
- `ReturnBarChart`
- `formatKRW`
- `STOCK_BAR_COLORS`
- `stockColor()`
- `labelPixelWidth()`
- `BAR_CHART_MARGIN`

---

## 7. 구현 순서 (권장)

1. `globals.css` — 색상 토큰 + radius 변경
2. `economist-ui.ts` — 카드/입력 토큰 업데이트
3. `DashboardCharts.tsx` — 도넛 코드 삭제
4. `DashboardClient.tsx` — 전면 재구성
5. `AppPageLayout.tsx` — title 비어있을 때 헤더 숨김

---

## 8. 건드리지 말 것

- Dark mode 변수 (`:root[data-theme="dark"]`, `@media prefers-color-scheme: dark`)
- `NetWorthHistoryChart.tsx` 내부 로직
- `PortfolioPerformanceChart.tsx` 내부 로직
- `ActivityTimeline.tsx` 내부 로직
- `/journal`, `/stocks`, `/signals`, `/discover`, `/settings` 페이지
- DB 스키마, API 라우트
- `feature/research-framework` 브랜치의 research/ 파일들
- 인증 로직 (`@/auth`)

---

## 9. 타입 안전성 체크

변경 후 반드시:
```bash
cd /Users/gsf/dev/Cursor/gsf-investor && npx tsc --noEmit
```
타입 에러 0개 확인 후 커밋.

---

## 10. 커밋 메시지

```
feat: UI design refresh — warm ivory palette, Decision Panel, layout restructure

- globals.css: warm ivory bg (#F7F4EE), sea green profit (#2E8B57), terracotta loss (#C24D3A), radius 0px→6-8px
- economist-ui.ts: drop border-t-4 accent, rounded-lg token
- DashboardCharts.tsx: remove donut chart components
- DashboardClient.tsx: Hero strip (larger numbers) → Decision Panel → Net Worth chart → Holdings table → Return bar chart + Loans → Signals + Timeline
- AppPageLayout.tsx: skip header when title empty

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
