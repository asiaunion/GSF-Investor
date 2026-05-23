# 재무 검증 Phase B 실행 기록 (2026-05-23)

## 실행

```bash
python3 scripts/validate_financials_dart.py --all-active
```

로그: [financial-data-validation-report-2026-05-23-phase-b.log](./financial-data-validation-report-2026-05-23-phase-b.log)

## 결과 요약

- **종료 코드 1** — 다수 L1 FAIL (예상된 데이터 품질 이슈)
- **주요 원인 (문서화됨):**
  - `seed_portfolio.py` 백만원 스케일 vs `seed_financials_only.py` 원 단위 혼재
  - 분기(Q) vs DART `fnlttSinglAcntAll` 매핑·라벨 불일치
  - `dividend_per_share` DART 라벨 미매칭 → ref=None
- **운영 조치:** 스크리너·PER/PBR는 `valuation-metrics.ts` FY 규칙 유지; L1 FAIL 종목은 [financial-data-validation-exceptions.md](./financial-data-validation-exceptions.md)에 예외 등록 후 Phase C(US) 진행

## Phase C (다음)

US 종목 — DART 재무 없으면 가격·공시만 검증 (`--ticker` per US symbol).
