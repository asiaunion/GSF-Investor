# GSF-Investor UI Refactor v1.0 — AG Work Order

**작성일**: 2026-07-13  
**브랜치**: `feature/ia-refactor` (from `feature/ui-design-refresh` HEAD)  
**검증 담당**: Claude  
**구현 담당**: AG  
**타입체크**: `npx tsc --noEmit` (0 errors 필수)

---

## 목표 요약

기존 9개 메뉴 → **Portfolio** / **Research** 2개 메뉴로 통합.  
설정은 우상단 Profile Menu로 이동.  
디자인 방향: **Simply Wall St** 스타일 — 다크 배경 + 브라이트 그린 포인트.  
기존 기능은 삭제하지 않고 적절한 경로로 이동한다.

---

## Phase 0: 브랜치 준비

```bash
git checkout feature/ui-design-refresh
git pull
git checkout -b feature/ia-refactor
```

---

## Phase 1: 다크 모드 컬러 토큰 업그레이드

파일: `src/app/globals.css`

### 1-1. 다크 모드 전용 토큰 교체

아래 두 블록을 모두 교체한다 (`:root[data-theme="dark"]` 와 `@media (prefers-color-scheme: dark) :root:not([data-theme])`).

두 블록에 동일한 값을 적용:

```css
/* ── Dark Mode (Simply Wall St Style) ── */
--bg-base:        #0B0E12;
--bg-surface:     #131820;
--bg-elevated:    #1A2030;
--bg-overlay:     #131820;

--border-default: #1E2A38;
--border-subtle:  #172030;
--border-strong:  #2A3A50;

--text-primary:   #E8EEF5;
--text-secondary: #8A9EB8;
--text-muted:     #4D6070;
--text-disabled:  #2E3D4D;

--brand-red:      #FF5757;
--brand-blue:     #4A7FA5;
--brand-green:    #00C874;   /* Simply Wall St 스타일 브라이트 그린 */

/* Profit: 브라이트 그린 계열 */
--profit-500:     #00A860;
--profit-400:     #00C874;
--profit-bg:      rgba(0, 200, 116, 0.10);
--profit-border:  rgba(0, 200, 116, 0.22);

/* Loss: 브라이트 레드 */
--loss-500:       #E04040;
--loss-400:       #FF5757;
--loss-bg:        rgba(255, 87, 87, 0.10);
--loss-border:    rgba(255, 87, 87, 0.22);

/* Alpha: Neutral Steel */
--alpha-500:      #6A8AA8;
--alpha-400:      #8AAAC8;
--alpha-bg:       rgba(106, 138, 168, 0.10);
--alpha-border:   rgba(106, 138, 168, 0.25);

/* Warning: Amber */
--warn-500:       #CC8800;
--warn-400:       #F0A500;
--warn-bg:        rgba(240, 165, 0, 0.10);
--warn-border:    rgba(240, 165, 0, 0.22);

/* Satellite */
--satellite-500:  #6A8898;
--satellite-400:  #9AB0C0;
--satellite-bg:   rgba(106, 136, 152, 0.10);
--satellite-border: rgba(106, 136, 152, 0.25);

/* Adaptive (dark) */
--adaptive-red-400:     #FF5757;
--adaptive-amber-400:   #F0A500;
--adaptive-emerald-400: #00C874;
--adaptive-blue-400:    #5BAAFF;
--adaptive-violet-400:  #A78BFA;
```

### 1-2. `economist-ui.ts` 다크 모드 그림자 수정 없음

다크 모드에서 `shadow-sm`이 눈에 안 보이는 문제를 방지하기 위해  
`globals.css` `@theme` 블록의 그림자를 다음으로 교체:

```css
--shadow-sm:  0 1px 3px rgba(0,0,0,0.35);
--shadow-md:  0 4px 8px rgba(0,0,0,0.40);
--shadow-lg:  0 10px 20px rgba(0,0,0,0.45);
--shadow-card: 0 2px 8px rgba(0,0,0,0.40);
```

---

## Phase 2: Navbar 리팩터링

파일: `src/components/Navbar.tsx`

### 2-1. 새 구조

현재 10개 링크 → **Portfolio** + **Research** 2개 + 우상단 Profile Menu.

```
[G] GSF Investor    [Portfolio]  [Research]    [🔔 badge]  [Avatar ▼]
                                                              ↳ 설정
                                                              ↳ 로그아웃
```

### 2-2. 전체 파일 교체

아래 코드로 `src/components/Navbar.tsx` 를 완전히 교체한다:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { signOut } from "next-auth/react";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_LINKS = [
  { href: "/portfolio", label: "Portfolio" },
  { href: "/research", label: "Research" },
];

interface NavbarProps {
  email?: string | null;
}

export default function Navbar({ email }: NavbarProps) {
  const pathname = usePathname();
  const [alertCount, setAlertCount] = useState<number>(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const fetchBadge = async () => {
      try {
        const res = await fetch("/api/signals/badge");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setAlertCount(data.unresolvedCount ?? 0);
      } catch {}
    };
    fetchBadge();
    return () => { mounted = false; };
  }, [pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <nav className="border-b border-border-default bg-bg-surface/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href="/portfolio"
          className="group flex items-center gap-2.5 shrink-0"
          aria-label="GSF Investor 홈"
        >
          <span className="relative flex h-9 w-9 items-center justify-center border-2 border-brand-green bg-bg-base transition-colors group-hover:bg-brand-green/10">
            <span className="font-serif text-xl font-bold leading-none text-brand-green -mt-px">G</span>
            <span className="absolute -bottom-0.5 left-1 right-1 h-0.5 bg-brand-green/40 group-hover:bg-brand-green transition-colors" />
          </span>
          <span className="hidden sm:block font-serif font-semibold text-text-primary text-sm tracking-tight">
            GSF Investor
          </span>
        </Link>

        {/* Primary Nav */}
        <div className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
            const isResearch = link.href === "/research";
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-3.5 py-1.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "font-semibold text-brand-green bg-brand-green/12 border border-brand-green/25"
                    : "font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                }`}
              >
                {link.label}
                {isResearch && alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-loss-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {alertCount > 9 ? "9+" : alertCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Right: ThemeToggle + Profile */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-bg-elevated border border-border-strong hover:border-brand-green/40 transition-colors"
              aria-label="프로필 메뉴"
            >
              <span className="text-xs font-bold text-text-secondary">
                {email ? email[0].toUpperCase() : "U"}
              </span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-10 w-52 bg-bg-surface border border-border-default rounded-lg shadow-md py-1 z-50">
                {email && (
                  <div className="px-3 py-2 border-b border-border-default">
                    <p className="text-xs text-text-muted truncate">{email}</p>
                  </div>
                )}
                <Link
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
                >
                  <span>설정</span>
                </Link>
                <button
                  onClick={() => { setProfileOpen(false); signOut(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-loss-400 hover:bg-loss-bg transition-colors"
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
```

**의존성 확인**: `next-auth/react`에서 `signOut` import가 이미 있는지 확인.  
없으면 기존 로그아웃 로직(`/api/auth/signout` POST)으로 대체.

---

## Phase 3: 라우팅 구조 생성

### 3-1. 새 디렉터리 생성 목록

```
src/app/portfolio/
  layout.tsx
  page.tsx                ← redirect to /portfolio/holdings
  overview/page.tsx       ← WealthClient 재사용
  holdings/page.tsx       ← DashboardClient 재사용 (현 / 경로 내용)
  returns/page.tsx        ← ReturnBarChart 전용 페이지
  dividends/page.tsx      ← DividendsClient 재사용
  analysis/page.tsx       ← placeholder

src/app/research/
  layout.tsx
  page.tsx                ← redirect to /research/watchlist
  watchlist/page.tsx      ← 기존 /stocks 재사용
  screening/page.tsx      ← 기존 /discover 재사용
  updates/page.tsx        ← /signals + /disclosures 탭 통합
  [ticker]/page.tsx       ← 종목별 딥다이브 (placeholder)
```

### 3-2. 서브 네비게이션 레이아웃

**`src/app/portfolio/layout.tsx`** (Server Component):

```tsx
import { ReactNode } from "react";
import PortfolioSubNav from "@/components/PortfolioSubNav";

export default function PortfolioLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PortfolioSubNav />
      {children}
    </>
  );
}
```

**`src/components/PortfolioSubNav.tsx`** (Client Component, 신규 생성):

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/portfolio/overview", label: "Overview" },
  { href: "/portfolio/holdings", label: "Holdings" },
  { href: "/portfolio/returns", label: "Returns" },
  { href: "/portfolio/dividends", label: "Dividends" },
  { href: "/portfolio/analysis", label: "Analysis" },
];

export default function PortfolioSubNav() {
  const pathname = usePathname();
  return (
    <div className="border-b border-border-default bg-bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`shrink-0 px-4 py-3 text-sm border-b-2 transition-colors ${
                  isActive
                    ? "border-brand-green font-semibold text-brand-green"
                    : "border-transparent font-medium text-text-muted hover:text-text-secondary hover:border-border-strong"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
```

**`src/app/research/layout.tsx`** (Server Component):

```tsx
import { ReactNode } from "react";
import ResearchSubNav from "@/components/ResearchSubNav";

export default function ResearchLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ResearchSubNav />
      {children}
    </>
  );
}
```

**`src/components/ResearchSubNav.tsx`** (Client Component, 신규 생성):

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/research/watchlist", label: "Watchlist" },
  { href: "/research/screening", label: "Screening" },
  { href: "/research/updates", label: "Updates" },
];

export default function ResearchSubNav() {
  const pathname = usePathname();
  const isDynamic = pathname.match(/^\/research\/[A-Z0-9]+/);

  return (
    <div className="border-b border-border-default bg-bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = !isDynamic && (pathname === tab.href || pathname.startsWith(tab.href + "/"));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`shrink-0 px-4 py-3 text-sm border-b-2 transition-colors ${
                  isActive
                    ? "border-brand-green font-semibold text-brand-green"
                    : "border-transparent font-medium text-text-muted hover:text-text-secondary hover:border-border-strong"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
          {isDynamic && (
            <span className="px-4 py-3 text-sm border-b-2 border-brand-green font-semibold text-brand-green">
              {pathname.split("/")[2]}
            </span>
          )}
        </nav>
      </div>
    </div>
  );
}
```

---

## Phase 4: Portfolio 페이지 구현

### 4-1. `/portfolio` 리디렉트

**`src/app/portfolio/page.tsx`**:
```tsx
import { redirect } from "next/navigation";
export default function PortfolioRoot() { redirect("/portfolio/holdings"); }
```

### 4-2. `/portfolio/holdings` — 기존 대시보드 내용 이동

기존 `src/app/page.tsx`의 **전체 내용**(auth 체크 + 데이터 fetch + JSX 렌더)을  
`src/app/portfolio/holdings/page.tsx`로 복사한다.

`AppPageLayout` 의 `title=""` `subtitle=""` 는 유지 (Portfolio Layout의 sub-nav가 타이틀 역할).

### 4-3. `/portfolio/overview` — 순자산 페이지

기존 `src/app/wealth/page.tsx`의 **전체 내용**을  
`src/app/portfolio/overview/page.tsx`로 복사한다.  
`AppPageLayout title="Overview"` `subtitle="전체 순자산·비주식 자산 현황"`으로 변경.

### 4-4. `/portfolio/returns` — 수익률 전용 페이지

**`src/app/portfolio/returns/page.tsx`**:

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import AppPageLayout from "@/components/AppPageLayout";
import { Suspense } from "react";
import ReturnsClient from "./ReturnsClient";

export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // stocks + holdings 기본 쿼리 (DashboardClient와 동일한 패턴 참고)
  const rows = await db.run(sql`
    SELECT
      s.ticker,
      s.name,
      s.market,
      COALESCE(SUM(tj.quantity * CASE WHEN tj.action = 'BUY' THEN 1 ELSE -1 END), 0) AS quantity,
      AVG(CASE WHEN tj.action = 'BUY' THEN tj.price END) AS avg_price,
      s.current_price,
      s.currency
    FROM stocks s
    LEFT JOIN trade_journal tj ON tj.stock_id = s.id
    WHERE s.is_active = 1
    GROUP BY s.id
    HAVING quantity > 0
    ORDER BY s.ticker
  `);

  return (
    <AppPageLayout
      email={session.user?.email}
      title="Returns"
      subtitle="보유 종목 수익률 분석"
      wide
    >
      <Suspense fallback={<p className="text-sm text-text-muted">불러오는 중…</p>}>
        <ReturnsClient rows={rows.rows} />
      </Suspense>
    </AppPageLayout>
  );
}
```

**`src/app/portfolio/returns/ReturnsClient.tsx`** (Client Component):  
기존 `DashboardCharts.tsx`의 `ReturnBarChart` 컴포넌트를 import해서  
풀페이지 차트로 렌더링하는 client component. 기본 구현:

```tsx
"use client";

import { ReturnBarChart, formatKRW } from "@/components/DashboardCharts";

type Row = readonly (string | number | null)[];

export default function ReturnsClient({ rows }: { rows: Row[] }) {
  const holdings = rows.map((r) => ({
    ticker: String(r[0]),
    name: String(r[1]),
    market: String(r[2]),
    quantity: Number(r[3]),
    avgPrice: r[4] != null ? Number(r[4]) : null,
    currentPrice: r[5] != null ? Number(r[5]) : null,
    currency: String(r[6]),
  }));

  // ReturnBarData interface: { ticker: string; name: string; returnRate: number }
  const chartData = holdings
    .filter((h) => h.avgPrice && h.currentPrice)
    .map((h) => ({
      ticker: h.ticker,
      name: h.name,
      returnRate: ((h.currentPrice! - h.avgPrice!) / h.avgPrice!) * 100,
    }))
    .sort((a, b) => b.returnRate - a.returnRate);

  if (chartData.length === 0) {
    return <p className="text-text-muted text-sm">데이터 없음</p>;
  }

  return (
    <div className="space-y-6">
      <ReturnBarChart data={chartData} height={Math.max(300, chartData.length * 40)} />
    </div>
  );
}
```

> **주의**: `ReturnBarChart`가 받는 `data` prop 타입을 `DashboardCharts.tsx`에서 확인 후 맞춰서 작성.  
> 타입 불일치 시 `ReturnBarChart`가 받는 형태를 우선시한다.

### 4-5. `/portfolio/dividends` — 배당 페이지

기존 `src/app/dividends/page.tsx`의 **전체 내용**을  
`src/app/portfolio/dividends/page.tsx`로 복사한다.  
`AppPageLayout title="Dividends"` 로 변경.

### 4-6. `/portfolio/analysis` — 플레이스홀더

**`src/app/portfolio/analysis/page.tsx`**:

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppPageLayout from "@/components/AppPageLayout";

export default async function AnalysisPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <AppPageLayout email={session.user?.email} title="Analysis" subtitle="포트폴리오 분석">
      <div className="flex flex-col items-center justify-center py-24 text-text-muted">
        <p className="text-lg font-medium">곧 제공됩니다</p>
        <p className="text-sm mt-1">섹터 배분, 상관관계, 리스크 분석 예정</p>
      </div>
    </AppPageLayout>
  );
}
```

---

## Phase 5: Research 페이지 구현

### 5-1. `/research` 리디렉트

**`src/app/research/page.tsx`**:
```tsx
import { redirect } from "next/navigation";
export default function ResearchRoot() { redirect("/research/watchlist"); }
```

### 5-2. `/research/watchlist` — 관심종목 (기존 /stocks)

기존 `src/app/stocks/page.tsx`의 **전체 내용**을  
`src/app/research/watchlist/page.tsx`로 복사한다.  
`AppPageLayout title="Watchlist"` `subtitle="관심종목 체크리스트 · 포지션 현황"` 으로 변경.

> **주의**: `StocksClient` 또는 `stocks/page.tsx`가 Client Component라면  
> server component wrapper를 새로 만들고 기존 client component를 import한다.

### 5-3. `/research/screening` — 종목 발굴 (기존 /discover)

기존 `src/app/discover/page.tsx`의 **전체 내용**을  
`src/app/research/screening/page.tsx`로 복사한다.  
`AppPageLayout title="Screening"` `subtitle="체크리스트·AI 스코어보드로 투자 기회를 발굴하세요"` 으로 변경.

`DiscoverTabs` import 경로: 기존 `./DiscoverTabs` → `@/app/discover/DiscoverTabs` 또는  
`DiscoverTabs` 파일을 `src/components/DiscoverTabs.tsx`로 이동 후 import 수정.

### 5-4. `/research/updates` — 시그널+공시 통합

**`src/app/research/updates/page.tsx`** (Server Component):

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import AppPageLayout from "@/components/AppPageLayout";
import UpdatesClient from "./UpdatesClient";
import type { SignalRow } from "@/app/signals/SignalsClient";
import type { DisclosureRow } from "@/app/disclosures/DisclosuresClient";

export const dynamic = "force-dynamic";

async function fetchSignals() {
  const rows = await db.run(sql`
    SELECT
      sg.id, sg.stock_id, s.ticker, s.name AS stock_name,
      sg.detected_at, sg.type, sg.severity, sg.description,
      sg.is_resolved, sg.resolved_note
    FROM signals sg
    JOIN stocks s ON s.id = sg.stock_id
    ORDER BY sg.detected_at DESC
    LIMIT 100
  `);
  return rows.rows.map((r) => ({
    id: Number(r[0]),
    stockId: Number(r[1]),
    ticker: String(r[2]),
    stockName: String(r[3]),
    detectedAt: String(r[4]),
    type: String(r[5]),
    severity: String(r[6]),
    description: String(r[7]),
    isResolved: Number(r[8]),
    resolvedNote: r[9] != null ? String(r[9]) : null,
  })) as SignalRow[];
}

async function fetchDisclosures() {
  const rows = await db.run(sql`
    SELECT
      d.id, d.stock_id, s.ticker, s.name AS stock_name, s.market,
      d.source, d.filed_at, d.title, d.summary_ai, d.raw_url
    FROM disclosures d
    JOIN stocks s ON s.id = d.stock_id
    ORDER BY d.filed_at DESC
    LIMIT 100
  `);
  return rows.rows.map((r) => ({
    id: Number(r[0]),
    stockId: Number(r[1]),
    ticker: String(r[2]),
    stockName: String(r[3]),
    market: String(r[4]),
    source: String(r[5]),
    filedAt: String(r[6]),
    title: String(r[7]),
    summaryAi: r[8] != null ? String(r[8]) : null,
    rawUrl: r[9] != null ? String(r[9]) : null,
  })) as DisclosureRow[];
}

export default async function UpdatesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [signals, disclosures] = await Promise.all([fetchSignals(), fetchDisclosures()]);

  return (
    <AppPageLayout
      email={session.user?.email}
      title="Updates"
      subtitle="시그널 알림과 공시 업데이트"
      wide
    >
      <UpdatesClient signals={signals} disclosures={disclosures} />
    </AppPageLayout>
  );
}
```

**`src/app/research/updates/UpdatesClient.tsx`** (Client Component):

```tsx
"use client";

import { useState } from "react";
import { tabActive, tabInactive } from "@/lib/economist-ui";
import SignalsClient from "@/app/signals/SignalsClient";
import DisclosuresClient from "@/app/disclosures/DisclosuresClient";
import type { SignalRow } from "@/app/signals/SignalsClient";
import type { DisclosureRow } from "@/app/disclosures/DisclosuresClient";

type Tab = "signals" | "disclosures";

export default function UpdatesClient({
  signals,
  disclosures,
}: {
  signals: SignalRow[];
  disclosures: DisclosureRow[];
}) {
  const [tab, setTab] = useState<Tab>("signals");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-border-default pb-0">
        {(["signals", "disclosures"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 rounded-t text-sm transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-brand-green font-semibold text-brand-green"
                : "border-transparent font-medium text-text-muted hover:text-text-secondary"
            }`}
          >
            {t === "signals" ? `시그널 (${signals.filter(s => !s.isResolved).length})` : `공시 (${disclosures.length})`}
          </button>
        ))}
      </div>
      {tab === "signals" && <SignalsClient initialData={signals} />}
      {tab === "disclosures" && <DisclosuresClient initialData={disclosures} />}
    </div>
  );
}
```

> **주의**: `SignalsClient`와 `DisclosuresClient`가 props를 어떻게 받는지 확인 필요.  
> 현재 `SignalsClient`가 `initialData` prop을 받지 않는다면:  
> - `signals/SignalsClient.tsx`에 `initialData?: SignalRow[]` prop을 추가하거나  
> - `UpdatesClient`에서 직접 렌더링 로직을 복사

### 5-5. `/research/[ticker]` — 종목 딥다이브 (플레이스홀더)

**`src/app/research/[ticker]/page.tsx`**:

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppPageLayout from "@/components/AppPageLayout";

export default async function ResearchTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const { ticker } = await params;

  return (
    <AppPageLayout
      email={session.user?.email}
      title={ticker.toUpperCase()}
      subtitle="종목 딥다이브 — Thesis · AI Report · Signals · Notes"
    >
      <div className="flex flex-col items-center justify-center py-24 text-text-muted">
        <p className="text-lg font-medium">곧 제공됩니다</p>
        <p className="text-sm mt-1">{ticker.toUpperCase()} 종목 상세 분석 페이지</p>
      </div>
    </AppPageLayout>
  );
}
```

---

## Phase 6: 기존 경로 리디렉트

기존 page.tsx 파일들을 **삭제하지 않고** 내용을 리디렉트로 교체한다.

| 파일 | 기존 | 새 경로 |
|------|------|---------|
| `src/app/page.tsx` | 대시보드 | `/portfolio/holdings` |
| `src/app/wealth/page.tsx` | 전체 자산 | `/portfolio/overview` |
| `src/app/stocks/page.tsx` | 관심종목 | `/research/watchlist` |
| `src/app/dividends/page.tsx` | 배당 | `/portfolio/dividends` |
| `src/app/discover/page.tsx` | 종목 발굴 | `/research/screening` |
| `src/app/signals/page.tsx` | 시그널 | `/research/updates` |
| `src/app/disclosures/page.tsx` | 공시 | `/research/updates` |
| `src/app/reports/page.tsx` | AI 보고서 | `/research` |
| `src/app/journal/page.tsx` | 매매 일지 | `/portfolio/holdings` |

각 파일을 아래 패턴으로 교체:

```tsx
import { redirect } from "next/navigation";
export default function LegacyPage() { redirect("/portfolio/holdings"); }  // 각 경로에 맞게 수정
```

> **경고**: 각 page.tsx의 데이터 fetch/import 코드는 모두 제거하되,  
> `SignalsClient.tsx`, `DisclosuresClient.tsx`, `DiscoverTabs.tsx` 등  
> **Client Component 파일 자체는 절대 삭제하지 않는다**.

---

## Phase 7: AppPageLayout 서브 네비 제외 처리

Portfolio/Research layout.tsx가 서브 네비를 렌더링하므로,  
`AppPageLayout`에는 별도 수정 불필요.

단, Portfolio/Research 하위 페이지에서 `AppPageLayout`의 `title`을 쓸 때  
서브 네비가 이미 섹션을 표시하므로 **간결한 제목** 사용 (위 Phase 4-5 스펙 참조).

---

## Phase 8: `/portfolio/holdings`의 Hero Strip 조정

기존 `DashboardClient.tsx`는 `page.tsx`에서 import한다.  
`/portfolio/holdings/page.tsx`로 이동 후 `DashboardClient` import 경로 조정:

```tsx
import DashboardClient from "@/app/DashboardClient";
// (원래 ./DashboardClient → 절대경로로 변경)
```

또는 `DashboardClient.tsx` 자체를 `src/components/`로 이동해도 된다.  
단, 이 경우 `DashboardClient.tsx` 내 상대경로 import들도 함께 수정.

---

## 구현하지 않는 것 (이번 PR 범위 외)

- Journal 기능의 종목별 stock detail 통합 (별도 PR)
- `/research/[ticker]` 실제 내용 구현 (placeholder만)
- `/portfolio/analysis` 실제 구현 (placeholder만)
- Returns 페이지 심층 차트 (기본 ReturnBarChart만)
- 모바일 서브 네비 드로어 (단순 가로 스크롤로 처리)

---

## 삭제 금지 목록

절대 삭제/이동하면 안 되는 파일:

```
src/app/signals/SignalsClient.tsx
src/app/disclosures/DisclosuresClient.tsx
src/app/discover/DiscoverTabs.tsx
src/app/stocks/page.tsx (리디렉트로 교체만)
src/app/journal/JournalFormToggle.tsx
src/app/journal/JournalTabs.tsx
src/components/JournalMigrationBanner.tsx
src/components/DashboardCharts.tsx
src/app/DashboardClient.tsx
src/app/wealth/WealthClient.tsx
src/app/dividends/DividendsClient.tsx
```

---

## 타입 내보내기 주의사항

### SignalRow / DisclosureRow 타입 이동 (필수)

현재 `SignalRow`는 `src/app/signals/page.tsx`에서, `DisclosureRow`는 `src/app/disclosures/page.tsx`에서 export된다.  
Phase 6에서 이 파일들을 리디렉트로 교체하면 타입이 사라져 빌드가 깨진다.

**해결책 (Phase 6 시작 전에 먼저 수행)**:

1. `src/app/signals/page.tsx`에서 `export type SignalRow = {...}` 블록을  
   `src/app/signals/SignalsClient.tsx` 파일 상단으로 이동 (import 방향을 역전)

2. `src/app/disclosures/page.tsx`에서 `export type DisclosureRow = {...}` 블록을  
   `src/app/disclosures/DisclosuresClient.tsx` 파일 상단으로 이동

3. `SignalsClient.tsx`의 기존 `import type { SignalRow } from "./page"` 제거  
   `DisclosuresClient.tsx`의 기존 `import type { DisclosureRow } from "./page"` 제거

4. `updates/UpdatesClient.tsx`에서:
   ```ts
   import type { SignalRow } from "@/app/signals/SignalsClient";
   import type { DisclosureRow } from "@/app/disclosures/DisclosuresClient";
   ```

### ReturnBarChart 데이터 형태

`ReturnBarChart`가 받는 데이터 타입은 `{ ticker: string; name: string; returnRate: number }`.  
`ReturnsClient.tsx` 구현 시 이 형태를 맞춰야 한다 (이미 위 Phase 4-4 코드에 반영됨).

---

## 완료 체크리스트

- [ ] `git checkout -b feature/ia-refactor` (from feature/ui-design-refresh)
- [ ] Phase 1: globals.css 다크 모드 토큰 교체
- [ ] Phase 2: Navbar.tsx 2메뉴 + Profile Menu 교체
- [ ] Phase 3: portfolio/layout.tsx + PortfolioSubNav.tsx 생성
- [ ] Phase 3: research/layout.tsx + ResearchSubNav.tsx 생성
- [ ] Phase 4-1: /portfolio/page.tsx (redirect)
- [ ] Phase 4-2: /portfolio/holdings/page.tsx (DashboardClient 이동)
- [ ] Phase 4-3: /portfolio/overview/page.tsx (WealthClient 재사용)
- [ ] Phase 4-4: /portfolio/returns/page.tsx + ReturnsClient.tsx
- [ ] Phase 4-5: /portfolio/dividends/page.tsx (DividendsClient 재사용)
- [ ] Phase 4-6: /portfolio/analysis/page.tsx (placeholder)
- [ ] Phase 5-1: /research/page.tsx (redirect)
- [ ] Phase 5-2: /research/watchlist/page.tsx (stocks 재사용)
- [ ] Phase 5-3: /research/screening/page.tsx (discover 재사용)
- [ ] Phase 5-4: /research/updates/page.tsx + UpdatesClient.tsx
- [ ] Phase 5-5: /research/[ticker]/page.tsx (placeholder)
- [ ] Phase 6: 기존 9개 page.tsx → redirect 교체
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run build` — 성공
- [ ] AG → Claude 검증 요청

---

## 검증 포인트 (Claude 담당)

구현 완료 보고 시 Claude가 확인할 항목:

1. **Navbar**: 2개 링크만 보임 (Portfolio, Research). Profile Menu 동작
2. **Portfolio sub-nav**: 5탭 표시, 활성 탭 하이라이트
3. **Research sub-nav**: 3탭 표시, Updates 탭 시그널+공시 통합
4. **다크 모드**: `--brand-green` 가 `#00C874`, `--bg-base` 가 `#0B0E12` 적용 확인
5. **구 URL**: `/signals` 접근 시 `/research/updates`로 리디렉트 확인
6. **빌드**: TypeScript 에러 0건
