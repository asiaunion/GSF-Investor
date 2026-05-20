# 실데이터 수동 검증 — 결과 보고 템플릿

검증 일시: `YYYY-MM-DD HH:MM (TZ)`  
실행자:  
대상 DB: Turso URL 마지막 세그먼트 / 별칭만 기재 (전체 URL은 공유 금지)

---

## 실행 범위

| 단계 | 스크립트/API | DRY_RUN | 비고 |
|------|----------------|---------|------|
| 1 | | ☐ yes ☐ no | |
| 2 | | ☐ yes ☐ no | |
| 3 | | ☐ yes ☐ no | |

---

## 환경

- `REAL_DATA_RUN_ACK` 설정 여부: ☐  
- `GITHUB_ACTIONS` / 로컬:  
- 사용 API 키 범위 (이름만): Turso / DART / Gemini / 기타  

---

## 로그 요약

- `daily_price`: (성공/실패, 삽입·스킵 건수 요약)  
- `daily_dart`: 공시 n건, HIGH 시그널 n건, Telegram 발송 여부  
- `daily_sec`:  
- `weekly_signal`: 시그널 n건  
- 앱 보고서: 생성 건수 / 오류  

---

## 데이터 무결성 점검 (쿼리 예시)

Turso 콘솔·CLI·Drizzle Studio 등에서 **실행 전후** 메모하거나 스냅샷을 비교합니다.

```sql
-- 최근 가격 행 수 (전일 기준으로 조정)
SELECT s.ticker, COUNT(*) AS n, MAX(p.date) AS last_date
FROM prices p JOIN stocks s ON s.id = p.stock_id
WHERE s.is_active = 1
GROUP BY s.ticker;

-- 최근 USDKRW
SELECT * FROM exchange_rates WHERE pair = 'USDKRW' ORDER BY date DESC LIMIT 5;

-- 최근 공시
SELECT s.ticker, d.source, d.filed_at, d.title
FROM disclosures d
JOIN stocks s ON s.id = d.stock_id
ORDER BY d.filed_at DESC LIMIT 20;

-- 최근 시그널
SELECT s.ticker, sig.type, sig.severity, sig.detected_at
FROM signals sig
JOIN stocks s ON s.id = sig.stock_id
ORDER BY sig.detected_at DESC LIMIT 30;

-- 최근 보고서
SELECT id, stock_id, created_at FROM reports ORDER BY created_at DESC LIMIT 10;
```

**실행 전 스냅샷** (필요 시 행 수/최대 날짜만):

- prices per ticker:  
- disclosures count (당일):  
- signals count (당일):  

**실행 후 동일 지표**:  

**이상 징후** (중복 rcp_no, 미래 날짜, NULL 필수 컬럼 등):  

---

## 이슈 / 조치

| 이슈 | 심각도 | 조치 |
|------|--------|------|
| | | |

---

## 판정

- ☐ **PASS** — 무결성 기준 충족, 운영 유지 또는 자동화 확장 검토 가능  
- ☐ **PASS WITH NOTES** — 경미한 이슈, 문서화 후 재검증 기한:  
- ☐ **FAIL** — 원인 / 롤백·재시도 계획:  
