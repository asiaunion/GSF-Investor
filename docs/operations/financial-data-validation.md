# 재무·밸류에이션 데이터 검증 런북

DB [`financials`](../../src/db/schema.ts) / [`prices`](../../src/db/schema.ts) 적재 정확도와, 앱에서 계산하는 **PER, PBR, ROE, 배당수익률, EPS** 신뢰성을 검증합니다.

파이프라인 가동 검증은 [real-data-manual-validation.md](./real-data-manual-validation.md) — 본 문서는 **숫자 정확도** 전용입니다.

---

## 검증 계층 (4 Layer)

| Layer | 질문 | 도구 |
|-------|------|------|
| L1 | DB가 DART와 같은가? | `scripts/validate_financials_dart.py` |
| L2 | DB 저장 파생값(eps,bps,debt_ratio)이 원시 필드 재계산과 일치하는가? | 동일 스크립트 L2 모드 |
| L3 | PER/PBR/배당수익률/ROE가 공식 재계산과 일치하는가? | `scripts/validate_valuation_metrics.py` |
| L4 | 화면별 지표 정의가 같은가? | 코드 리뷰 + L3 API 비교 |

---

## Layer 1 — DART 대비 DB

**대상:** `stocks.dart_corp_code IS NOT NULL`, `financials.source = 'DART'`

**절차:**

1. DB 행 조회 (`period`, 원시 금액 필드)
2. `period` → `(bsns_year, reprt_code)` 매핑  
   - `YYYYFY` → `11011`  
   - `YYYYQ1/Q2/Q3` → `11013` / `11012` / `11014`
3. DART `fnlttSinglAcntAll` 재조회 (CFS → OFS 폴백, 시딩과 동일)
4. 필드 diff

**허용 오차:**

| 필드 | 기준 |
|------|------|
| revenue, op_income, net_income, total_assets, total_equity | 상대 0.1% 또는 절대 1원 |
| debt_ratio | 1%p |
| dividend_per_share, DART EPS 라벨 | 상대 1% 또는 절대 1원 |

**알려진 이슈:** [`seed_portfolio.py`](../../scripts/seed_portfolio.py)는 금액에 `×1_000_000`을 적용하고, [`seed_financials_only.py`](../../scripts/seed_financials_only.py)는 원 단위 그대로 사용합니다. L1 FAIL 시 **스케일 불일치(백만원)** 여부를 먼저 확인하세요.

```bash
python3 scripts/validate_financials_dart.py --ticker 026960
python3 scripts/validate_financials_dart.py --all-active
```

---

## Layer 2 — DB 내부 재계산

| 저장 컬럼 | 재계산 |
|-----------|--------|
| eps | `net_income / shares_outstanding` (시딩 규칙과 동일 시 일치) |
| bps | DART BPS 라벨 없을 때 `total_equity / shares_outstanding` |
| debt_ratio | `(total_assets - total_equity) / total_equity * 100` |
| roe | DB `roe`는 보통 NULL — `net_income / total_equity * 100` |

`shares_outstanding`은 **Yahoo**에서 시딩 시 채움 — DART와 별도.

---

## Layer 3 — 밸류에이션 지표

**기준 (종목 상세·API와 동일):**

- 가격: `prices` 최신 `close_price`
- 재무: 최신 **FY** (`period LIKE '%FY'`)
- `PER = price / eps_fy`
- `PBR = price / bps_fy`
- `배당수익률% = dividend_per_share_fy / price * 100`
- `ROE% = net_income_fy / total_equity_fy * 100`

**허용 오차:** 상대 0.5% 또는 UI 반올림 1자리

```bash
# 로컬 dev 서버 실행 중
python3 scripts/validate_valuation_metrics.py --ticker 026960 --base-url http://localhost:3000

# DB만 재계산 (API 없이)
python3 scripts/validate_valuation_metrics.py --ticker 026960 --db-only
```

---

## Layer 4 — 정의 일관성

| 지표 | 종목 상세 / API | Discover | 기대 |
|------|-----------------|----------|------|
| PER | FY EPS only | FY EPS only (TTM 제거) | 일치 |
| PBR | FY BPS 우선 | 최신 FY/ref | 문서화 |
| 배당수익률 | FY DPS | — | — |

구현: [`src/lib/valuation-metrics.ts`](../../src/lib/valuation-metrics.ts)

---

## SQL 참고

```sql
-- 종목별 DART 재무 행 수
SELECT s.ticker, f.period, f.revenue, f.eps, f.bps, f.debt_ratio, f.shares_outstanding
FROM financials f
JOIN stocks s ON s.id = f.stock_id
WHERE s.ticker = '026960' AND f.source = 'DART'
ORDER BY f.period DESC;

-- 최신 FY
SELECT period, eps, bps, net_income, total_equity, dividend_per_share
FROM financials f
JOIN stocks s ON s.id = f.stock_id
WHERE s.ticker = '026960' AND period LIKE '%FY'
ORDER BY period DESC LIMIT 1;

-- 최신 주가
SELECT date, close_price FROM prices p
JOIN stocks s ON s.id = p.stock_id
WHERE s.ticker = '026960'
ORDER BY date DESC LIMIT 1;
```

---

## 파일럿 → 전체 확대

1. **Phase A:** `026960`, `059090`, (선택) `069500` — L1~L3 PASS 또는 예외 문서화  
2. **Phase B:** `--all-active` L1/L2 배치  
3. **Phase C:** US 종목 — DART 재무 없으면 가격·공시만

결과는 [financial-data-validation-report-template.md](./financial-data-validation-report-template.md) 형식으로 저장합니다.

---

## 관련 문서

- [financial-data-validation-report-2026-05-20.md](./financial-data-validation-report-2026-05-20.md) (파일럿 결과)
- [financial-data-validation-exceptions.md](./financial-data-validation-exceptions.md) (FAIL·제외 규칙)
- [secret-handling.md](./secret-handling.md)
- [validation-report-2026-05-20.md](./validation-report-2026-05-20.md) (파이프라인·Production)
