# 재무·밸류에이션 검증 결과 (파일럿)

검증 일시: 2026-05-20  
실행자: agent (Turso production read + DART API)  
대상: 파일럿 `026960`, `059090`, `069500`  
DB: Turso `gsf-investor` (production)

---

## 요약

| Layer | PASS | FAIL | SKIP | 비고 |
|-------|------|------|------|------|
| L1 DART vs DB | 87 | 28 | 20 | 주로 `net_income`/`total_equity` 라벨·기간 정의 차이 |
| L2 DB 재계산 | 대부분 PASS | 1 | 일부 | `059090` 2024Q2 eps (shares NULL) |
| L3 밸류에이션 | 6 | 0 | 6 | 파일럿 2종 FY 기준 PER/PBR/ROE 재계산 OK |
| L4 정의 일관성 | — | — | — | Discover TTM PER 제거 → FY only (`valuation-metrics.ts`) |

**종합 판정:** **PASS WITH NOTES** — L3·L4는 파일럿 2종목 사용 가능. L1은 파서/계정 라벨 개선 전까지 참고용.

---

## L1 — DART vs DB (파일럿)

### 026960 동서

- `revenue`, `op_income`, `total_assets`: 대부분 **PASS**
- `net_income`, `total_equity`: 분기별 **FAIL** 다수 — DART API 누적/당기 구분·연결/별도(CFS/OFS)와 DB 시딩 시점 불일치 가능
- `2026Q1`: 미공시/조기 period — L1 FAIL 예상

### 059090 미코

- `total_equity` FAIL 빈번 — DART 음수 자본(결손) 구간과 DB 양수 저장 불일치 의심
- `2025FY` `net_income`: DART ref `0` vs DB 값 — 사업보고서 계정 라벨 재매핑 필요

### 069500 KODEX 200

- DART `financials` 행 없음 — ETF, **검증 제외** (가격만)

---

## L2 — DB 재계산

| ticker | 이슈 | status |
|--------|------|--------|
| 026960 | eps/bps/debt_ratio 대부분 PASS | OK |
| 059090 | 2024Q2 eps FAIL (shares_outstanding NULL) | 예외 문서화 |
| 069500 | 재무 없음 | SKIP |

---

## L3 — 밸류에이션 (FY, price 2026-05-20)

| ticker | PER | PBR | ROE% | DivYield |
|--------|-----|-----|------|----------|
| 026960 | 17.01 | 1.43 | 8.43 | SKIP (DPS 없음) |
| 059090 | 7.96 | 0.87 | 10.88 | SKIP |
| 069500 | SKIP | SKIP | SKIP | SKIP |

재계산 공식: [financial-data-validation.md](./financial-data-validation.md) Layer 3.

---

## L4 — 정의 일관성

- [x] Discover PER/PBR: **FY only** — [`src/lib/valuation-metrics.ts`](../../src/lib/valuation-metrics.ts)
- [x] 종목 상세 / API: `perBasis: "FY"`, `overviewBasis` 노출
- [x] TTM 4분기 합산 PER **제거** (checklist, all-scores)

---

## 조치·예외

| 이슈 | 조치 | 상태 |
|------|------|------|
| `seed_portfolio.py` 금액 `×1e6` vs `seed_financials_only` 원 단위 | L1 스케일 자동 감지(`pick_dart_scale`) — 추가 라벨 매핑 필요 | open |
| L1 equity/net_income FAIL | DART 계정명·CFS/OFS 재시딩 검토 | open |
| `059090` 2024Q2 eps L2 | shares_outstanding 백필 또는 시드 시 Yahoo 조회 | open |
| `069500` | ETF — 재무 L1~L3 제외 | documented |
| `217190` | `yahoo_ticker` 공백 — 가격·PER 검증 제외 (기존) | documented |

---

## Go/No-Go (파일럿)

- [x] 종목 상세 PER/PBR/ROE — DB+FY 기준 재계산 일관
- [x] Discover 스크리닝 PER — FY와 동일 정의
- [ ] L1 DART 원천 100% 일치 — **미달** (후속 파서/재시딩)

다음 단계: 활성 KR 전 종목 = 현재 `dart_corp_code` 보유 **2종목** (`026960`, `059090`) — [exceptions](./financial-data-validation-exceptions.md).
