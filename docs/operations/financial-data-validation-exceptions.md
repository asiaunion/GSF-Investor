# 재무 검증 예외·FAIL 규칙

`scripts/validate_financials_dart.py --all-active` 기준 (2026-05-20).

## 활성 KR + DART corp_code

| ticker | name | L1 FAIL (샘플) | L2 FAIL | 비고 |
|--------|------|----------------|---------|------|
| 026960 | 동서 | net_income, total_equity (다수 분기) | 0 | revenue/assets 대체로 PASS |
| 059090 | 미코 | net_income, total_equity | 2024Q2 eps | equity DART 음수 구간 |

## 검증 제외 (의도)

| ticker | 사유 |
|--------|------|
| 069500 | ETF — DART 단일회사 재무 없음 |
| 217190 | `yahoo_ticker` 미설정 — 가격·PER 불가 |
| US 종목 | `dart_corp_code` 없음 — L1 N/A |

## L1 FAIL 허용·재검토 규칙

1. **스케일:** DB 값 ≈ DART × 1e6 → `seed_portfolio.py` 재시딩 후 재검증  
2. **라벨:** `자본총계` vs `지배기업소유주지분` 등 — 파서에 별칭 추가  
3. **분기 누적:** 분기 `net_income`이 누적값이면 FY와 중복 검증만 신뢰  
4. **미래 period** (`2026Q1` 등): 공시 전 SKIP 처리 권장

## L2 FAIL

- `eps` FAIL + `shares_outstanding` NULL → Yahoo 시드 보완 후 PASS 기대

## 재실행

```bash
python3 scripts/validate_financials_dart.py --all-active
python3 scripts/validate_valuation_metrics.py --all-active --db-only
```
