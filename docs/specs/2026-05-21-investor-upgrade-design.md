# GSF-Investor 고도화 설계서 (v1 초안)

> **구현 정본**: [2026-05-21-investor-upgrade-design-v2.md](./2026-05-21-investor-upgrade-design-v2.md) — 코드베이스 감사 반영 (스키마·cron·기존 기능 정합)  
> **작성일**: 2026-05-21  
> **타임라인**: 1~2주 (Impact-First 접근)  
> **디자인 레퍼런스**: Koyfin (전체) + Simply Wall St (시각) + Empower (자산) + TradingView (차트 인터랙션)  
> **Economist 타이포그래피/톤 유지**

---

## 1. 배경

GSF-Portfolio가 GSF-Investor로 통합 완료. 현재 13개 DB 테이블, 14개 라우트가 존재하지만 다음이 부족:

- 시간에 따른 자산/포트폴리오 추이 추적 (데이터 미적재)
- 종목 비교·스크리닝 기능
- 포트폴리오 손익(P&L) 분석
- 벤치마크 대비 성과 비교
- 배당 캘린더
- 다통화 기준 통화 설정

**사용 패턴**: 개인 사용 (향후 가족 소규모 공유). 자산은 다양하지만 부동산은 정적 — **주식이 핵심 분석 대상** (한국 → 미국·일본 확장).

---

## 2. 실행 계획

### 접근: Impact-First

| 주차 | 핵심 작업 | 산출물 |
|------|----------|--------|
| **Week 1** | 종목 스크리닝 + 대시보드 리디자인 + snapshot cron 세팅 | `/discover` 리디자인, `/` 대시보드, cron 3개 |
| **Week 2** | P&L + 벤치마크 + 배당 캘린더 + 통화 설정 + 비주얼 폴리싱 | 포트폴리오 성과, `/dividends`, Settings 확장 |

---

## 3. 데이터 인프라

### 3.1 새 테이블

```sql
-- 포트폴리오 히스토리 (일별 — P&L 추이용)
CREATE TABLE portfolio_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  ticker TEXT NOT NULL,
  date TEXT NOT NULL,
  quantity REAL NOT NULL,
  avg_price REAL NOT NULL,
  market_price REAL,
  market_value REAL,
  unrealized_pnl REAL,
  currency TEXT DEFAULT 'KRW',
  UNIQUE(user_id, ticker, date)
);

-- 환율
CREATE TABLE exchange_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  rate REAL NOT NULL,
  date TEXT NOT NULL,
  UNIQUE(base_currency, quote_currency, date)
);

-- 사용자 기준 통화 설정
ALTER TABLE users ADD COLUMN base_currency TEXT DEFAULT 'KRW';
```

기존 `wealth_snapshots` 테이블은 그대로 사용 (이미 적절히 설계됨).

### 3.2 Cron Jobs

| Cron | 주기 | 동작 | API |
|------|------|------|-----|
| `wealth-snapshot` | 매주 금요일 18:00 KST | `wealth_entries` → `wealth_snapshots` 집계 | 내부 |
| `exchange-rates` | 매일 09:00 KST | USD/KRW, JPY/KRW 등 저장 | ExchangeRate-API |
| `portfolio-snapshot` | 매일 18:00 KST (주중) | `portfolio_holdings` × 당일 종가 → `portfolio_snapshots` | 내부 (`prices` 참조) |
| `benchmark-prices` | 기존 prices cron에 추가 | `^KS11` (KOSPI), `^GSPC` (S&P500) 종가 | Yahoo Finance |

### 3.3 환율 API

**ExchangeRate-API** 선택 (안정성 우선).
- Free tier: 1,500 req/month
- 필요량: 매일 1회 × 30일 = 30 req/month (충분)
- 통화 쌍: USD/KRW, JPY/KRW, USD/JPY

---

## 4. 종목 비교·스크리닝 (`/discover` 리디자인)

### 4.1 스크리너 필터

| 카테고리 | 필터 항목 | UI | 소스 |
|----------|----------|-----|------|
| **밸류에이션** | PER 범위, PBR 범위 | 레인지 슬라이더 | `financials` |
| **수익성** | ROE 범위, 영업이익률 범위 | 레인지 슬라이더 | `financials` 계산 |
| **성장** | 매출 성장률(YoY), EPS 성장률(YoY) | 레인지 슬라이더 | `financials` YoY 계산 |
| **배당** | 배당수익률 최소 | 슬라이더 | `financials.dividend_yield` |
| **가격** | 52주 고점 대비 하락률, 최근 수익률(1M/3M/6M/1Y) | 레인지 슬라이더 | `prices` 계산 |
| **시장** | KRX / NYSE / TYO | 체크박스 | `stocks.exchange` |
| **섹터** | 업종 | 멀티셀렉트 | `stocks.sector` |
| **포트폴리오** | 보유 종목만 / 미보유만 / 전체 | 라디오 | `portfolio_holdings` JOIN |

### 4.2 결과 테이블

- 정렬 가능 컬럼: 종목명, 시장, 현재가, PER, PBR, ROE, 배당수익률, 52주 수익률, 매출 성장률
- 행 클릭 → `/stocks/[ticker]`
- 체크박스 선택 → 비교 모드 (최대 5종목)

### 4.3 비교 모드 (`/discover?compare=TICKER1,TICKER2,...`)

선택 종목들을 나란히 비교:

- **비교 테이블**: 주요 지표 나란히
- **가격 수익률 비교 차트**: 정규화 % 수익률 라인 차트 (기간 선택: 1M/3M/6M/1Y/3Y)
- **재무 바 차트**: 매출/영업이익/순이익 나란히
- **레이더 차트 (Simply Wall St)**: 5축 — 밸류에이션/성장성/수익성/배당/안정성

### 4.4 레이더 차트 축 정의

| 축 | 지표 | 점수 산정 |
|---|------|----------|
| 밸류에이션 | PER, PBR | 업종 평균 대비 저평가일수록 높은 점수 |
| 성장성 | 매출 성장률, EPS 성장률 | 양(+) 성장일수록 높음 |
| 수익성 | ROE, 영업이익률 | 절대값 기준 |
| 배당 | 배당수익률 | 절대값 기준 |
| 안정성 | 52주 변동성 (표준편차 역수) | 변동성 낮을수록 높음 |

각 축 0~100 정규화.

---

## 5. 대시보드 리디자인 (`/`)

### 레이아웃 (위 → 아래)

#### ① 히어로 카드 (Koyfin 스타일)

3칸 카드: **총 투자자산** | **오늘 손익 (+₩, +%)** | **누적 수익률 (% + 기준일)**

- 전일 종가 기준
- 기준 통화(Settings)에 따라 환산 표시

#### ② 넷워스 추이 차트 (Empower 스타일)

- **Stacked Area Chart**: 자산 클래스별 (주식/현금/부동산/연금/암호화폐/기타)
- **기간 선택 버튼**: [1M] [3M] [6M] [1Y] [ALL]
- 데이터: `wealth_snapshots` (주간 적재)
- 호버 시 해당 날짜의 총액 + 클래스별 금액 툴팁

#### ③ 보유 종목 요약 (좌측)

- 종목명, 오늘 등락률, 비중(%)
- 상승/하락 컬러 코딩
- 클릭 → `/stocks/[ticker]`
- "더보기 →" 링크

#### ④ 자산 배분 도넛 차트 (우측)

- Simply Wall St 스타일: 중앙에 총자산 금액, 호버 시 세그먼트 확대
- 자산 클래스별 컬러 (§7 컬러 팔레트)

#### ⑤ 최근 활동 타임라인

- `trade_journal` + `dividends` + `disclosures` 통합 시간순
- 아이콘 + 한 줄 요약
- 최근 10건, "더보기 →"

---

## 6. Week 2 기능

### 6.1 포트폴리오 성과

**종목별 P&L 테이블**:
- 종목, 수량, 평균매입가, 현재가, 평가액, 손익(₩), 수익률(%)
- 정렬/필터 가능

**포트폴리오 수익률 차트**:
- `portfolio_snapshots` 기반 라인 차트
- 기간 선택: 1M/3M/6M/1Y/ALL

**비중 도넛 차트**:
- 종목별 비중
- 섹터별 그룹핑 토글

### 6.2 벤치마크 비교

- 포트폴리오 수익률 차트에 **벤치마크 라인 오버레이**
- KOSPI (`^KS11`): 한국 주식 보유 시 표시
- S&P 500 (`^GSPC`): 미국 주식 보유 시 표시
- 정규화 % 수익률로 같은 축

### 6.3 배당 캘린더

**캘린더 뷰**: 월간 캘린더에 배당락일(ex_date), 입금일(pay_date) 마커
**리스트 뷰**: 시간순 배당 리스트 (토글)
**요약**:
- 월별 예상 배당 수입
- 연간 예상 배당 수입 + 배당수익률

보유 종목 기준 자동 필터 (전체 종목 보기도 가능).

### 6.4 기준 통화 설정

- `/settings`에 기준 통화 드롭다운 (KRW / USD / JPY)
- `users.base_currency`에 저장
- 모든 금액 표시에 환율 반영 (`exchange_rates` 테이블 참조)
- 차트 축 레이블, 히어로 카드, P&L 테이블 등에 일괄 적용

---

## 7. 비주얼 디자인 시스템

### 디자인 원칙

| 원칙 | 레퍼런스 | 적용 |
|------|----------|------|
| 데이터 밀도 | Koyfin | 테이블·숫자 중심, 불필요한 여백 제거 |
| 시각적 매력 | Simply Wall St | 레이더 차트, 그라데이션 Area, 컬러풀 도넛 |
| 타이포그래피 | Economist (유지) | Outfit 폰트, 데이터는 tabular-nums |
| 차트 인터랙션 | TradingView | 호버 툴팁, 기간 선택, 크로스헤어 커서 |
| 다크/라이트 | 현행 유지 | `next-themes`, CSS 변수 전환 |

### 컬러 팔레트

```css
/* 수익/손실 */
--color-gain: hsl(145, 70%, 45%);
--color-loss: hsl(0, 75%, 50%);
--color-neutral: hsl(220, 10%, 60%);

/* 자산 클래스 */
--color-equity: hsl(220, 80%, 55%);     /* 딥 블루 */
--color-cash: hsl(145, 60%, 50%);       /* 그린 */
--color-real-estate: hsl(30, 75%, 55%); /* 오렌지 */
--color-pension: hsl(270, 60%, 55%);    /* 퍼플 */
--color-crypto: hsl(45, 90%, 50%);      /* 골드 */
--color-other: hsl(200, 20%, 65%);      /* 슬레이트 */
```

### 차트 업그레이드

| 항목 | 변경 |
|------|------|
| 호버 | 크로스헤어 + 상세 툴팁 (날짜, 값, 변동) |
| 기간 선택 | `[1M] [3M] [6M] [1Y] [ALL]` 버튼 그룹 |
| 비교 | 정규화 % 수익률 오버레이 |
| 도넛 | 중앙 총액, 호버 시 세그먼트 확대 |
| 레이더 | 5축 (밸류에이션/성장/수익성/배당/안정성) |
| Area | Stacked, 자산 클래스별 컬러 그라데이션 |

### 반응형

- 데스크톱: 2~3 컬럼 그리드
- 태블릿: 2 → 1 컬럼 접힘
- 모바일: 1 컬럼, 히어로 카드 가로 스와이프, 차트 풀폭

---

## 8. 기술 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| 차트 라이브러리 | Recharts (유지) | 이미 사용 중. 커스텀 툴팁/인터랙션 추가로 TradingView 수준 근접 가능 |
| 레이더 차트 | Recharts `RadarChart` | 별도 라이브러리 불필요 |
| 환율 API | ExchangeRate-API | 안정적, free tier 충분 |
| 벤치마크 데이터 | Yahoo Finance (`yahoo-finance2`) | 이미 프로젝트에 설치됨 |
| 상태 관리 | React Server Components + API Routes | 현행 패턴 유지 |

---

## 9. 라우트 변경 요약

| 라우트 | 변경 |
|--------|------|
| `/` | 전면 리디자인 (5영역 대시보드) |
| `/discover` | 스크리너 + 비교 모드 전면 리디자인 |
| `/stocks/[ticker]` | 레이더 차트 추가, 차트 인터랙션 강화 |
| `/wealth` | 도넛 차트 업그레이드, 통화 표시 반영 |
| `/dividends` (신규) | 배당 캘린더 + 리스트 뷰 |
| `/settings` | 기준 통화 설정 추가 |
| `/api/cron/wealth-snapshot` (신규) | 주간 wealth 스냅샷 |
| `/api/cron/portfolio-snapshot` (신규) | 일별 포트폴리오 스냅샷 |
| `/api/cron/exchange-rates` (신규) | 일별 환율 |
