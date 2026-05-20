# 재무·밸류에이션 검증 결과

검증 일시:  
실행자:  
대상: `pilot` | `all-active-kr`  
DB: Turso `gsf-investor` (별칭만 기재)

---

## 요약

| Layer | PASS | FAIL | SKIP | 비고 |
|-------|------|------|------|------|
| L1 DART vs DB | | | | |
| L2 DB 재계산 | | | | |
| L3 밸류에이션 | | | | |
| L4 정의 일관성 | | | | |

**종합 판정:** PASS | PASS WITH NOTES | FAIL

---

## L1 — DART vs DB (종목별)

| ticker | period | field | db | dart | diff | status |
|--------|--------|-------|-----|------|------|--------|
| | | | | | | |

스케일 이슈 의심 시 메모:

---

## L2 — DB 재계산

| ticker | period | field | stored | recomputed | status |
|--------|--------|-------|--------|------------|--------|
| | | eps | | | |
| | | bps | | | |
| | | debt_ratio | | | |

---

## L3 — 밸류에이션 (FY 기준)

| ticker | metric | recomputed | api | page_match | status |
|--------|--------|------------|-----|------------|--------|
| | PER | | | | |
| | PBR | | | | |
| | DivYield% | | | | |
| | ROE% | | | | |

- price_date:  
- fy_period:  

---

## L4 — 정의 일관성

- [ ] Discover PER = 종목 상세 FY PER (샘플 종목: )
- [ ] `overviewBasis` / FY 기간 표시 일치

---

## 조치·예외

| 이슈 | 조치 | 상태 |
|------|------|------|
| | | |

---

## Go/No-Go

- [ ] 대시보드·종목 상세 재무 지표 신뢰 사용 가능
- [ ] Discover 스크리닝 PER/PBR 신뢰 사용 가능
- [ ] 재시딩 / 파서 수정 필요
