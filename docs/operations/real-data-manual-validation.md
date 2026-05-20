# 실데이터(운영 Turso) 수동 검증 런북

운영 또는 운영과 동일한 원격 Turso에 **직접 쓰기**가 발생하는 검증입니다. 자동 크론과 별개로 **로컬 또는 수동 트리거 한 번**을 안전하게 수행하기 위한 절차입니다.

---

## 1. 사전 분류 — 쓰기 경로 및 위험도

| 경로 | 무엇을 쓰나 | 위험도 | 비고 |
|------|-------------|--------|------|
| `scripts/daily_price.py` | `prices` (UPSERT 성격), `exchange_rates` | 중 | 활성 종목 단위 |
| `scripts/daily_dart.py` | `disclosures`, `signals`(HIGH), Telegram | 높음 | 알림 발송 가능 |
| `scripts/daily_sec.py` | `disclosures`(SEC), Telegram | 중 | US 종목 있을 때 |
| `scripts/weekly_signal.py` | `signals`(LOW/MEDIUM), Telegram | 중 | 집계 규칙 따라 다건 |
| `scripts/seed_portfolio.py` | 종목·일지·가격·환율·재무 대량 시딩 | **매우 높음** | 수동 검증에서는 **금지 권장** |
| `scripts/seed_financials_only.py` | `financials` 대량 UPSERT | 높음 | 수동 검증에서 **금지 권장** |
| `scripts/create_views.py` | View DROP/CREATE | 중 | 스키마 DDL |
| `scripts/db-views.mjs` | `v_portfolio` CREATE | 낮음–중 | 원격 시 가드 동일 |
| `scripts/migrate_sector.py` | `stocks` 업데이트 | 중 | **현재 `real_data_guard` 미연동** — 운영에서 실행 시 별도 승인 |
| `POST /api/reports/generate` | `reports` + Gemini 비용 | 중–높음 | 브라우저/API로만 |
| `POST /api/reports/auto` | 여러 종목 `reports` + 비용 | 높음 | HIGH 시그널 종목만 |
| 앱: `journal`, `loans`, 설정 API | 거래·설정 | 운영 영향 | 수동 점검 선택 |

**금지(이번 런북 기본):** `seed_*`, `migrate_sector.py`(미가드) 대량/DDL 마이그레이션은 별도 변경관리 없이 운영 검증에 넣지 않습니다.

---

## 2. 필수 환경 변수 확인

시크릿을 로컬에 맞출 때는 [시크릿 취급 가이드](secret-handling.md)를 따릅니다. **브라우저 에이전트로 Vercel 대시보드에서 키를 추출하지 마세요.**

- **Turso**: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` — 값이 **운영 DB**와 일치하는지 사람이 한 번 더 확인합니다.
- **원격 쓰기 허용**: `REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE` (로컬에서만 필요. `file:` DB는 불필요)
- **드라이 러닝**: `DRY_RUN=1` — 일일/주간 배치는 **배치 INSERT 생략**(조회·외부 API는 그대로 진행될 수 있음). **시딩 스크립트는 DRY_RUN 미지원**이며 원격에서 실행하지 않습니다.
- **DART**: `scripts/daily_dart.py` → `DART_API_KEY`
- **보고서**: `GEMINI_API_KEY`, NextAuth·세션으로 보호된 엔드포인트

`.env.example`에 주석으로 동일 항목이 있습니다.

---

## 3. Preflight 체크리스트

- [ ] 백업/스냅샷: Turso 콘솔 등 **복구 수단**을 확인했는가.
- [ ] `TURSO_DATABASE_URL`이 의도한 인스턴스인가 (라벨·이름·리전).
- [ ] 거래 시간대: 시장/공시 API 부하·일관성을 고려했는가.
- [ ] **1단계**: `DRY_RUN=1`으로 동일 스크립트를 한 번 돌려 로그·API 오류가 없는지 확인.
- [ ] **2단계**: `DRY_RUN` 해제 + `REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE` 설정 후 최소 한 사이클만 실행.

---

## 4. 권장 실행 순서 (최소 범위)

운영 DB에 **실제 쓰기**를 넣는 경우:

1. `daily_price.py` — 가격·환율 한 영업일 분.
2. `daily_dart.py` — DART 공시·HIGH 시그널(알림 주의).
3. `daily_sec.py` — US 종목이 있을 때만 의미 있음.
4. `weekly_signal.py` — 주간 집계(일요일 스케줄과 별개로 수동이면 “의도적 재실행”임).

**로컬 예시 (원격 쓰기 — 본인 환경에서만):**

```bash
export REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE
# .env.local 이 이미 있다면 주석 처리하거나 위 두 변수만 명시적으로 export
python3 scripts/daily_price.py
python3 scripts/daily_dart.py
python3 scripts/daily_sec.py
python3 scripts/weekly_signal.py
```

**드라이 런 (쓰기 생략):**

```bash
export DRY_RUN=1
python3 scripts/daily_price.py
# …
```

**GitHub Actions:** 각 워크플로 단계에 `REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE`가 설정되어 있어야 스크립트가 원격에 쓸 수 있습니다.

---

## 5. 앱/API 수동 점검 (선택)

- 배포 URL에서 로그인 후 보고서 생성 UI 사용, 또는  
- `POST /api/reports/auto` — HIGH 시그널이 있는 종목만 대상; **Gemini 비용·reports 행 증가** 주의.

---

## 6. 성공 기준 / 중단 기준

**성공**

- 스크립트 exit 0(또는 정책상 허용한 일부 실패만 exit 1).
- Turso에서 기대 테이블에 행이 생기거나 `INSERT OR IGNORE`로 기존과 충돌 없음.
- 중복 키·NULL 위반 없음.

**중단**

- Turso HTTP 4xx/5xx 연속.
- DART/SEC rate limit 또는 인증 오류.
- 예상보다 **과다 insert 건수**(로그의 “신규 n건”이 비정상적으로 큼).

---

## 7. 실행 후 무결성 점검 (요약)

자세한 쿼리 예시는 [데이터 무결성 점검](real-data-validation-report-template.md#데이터-무결성-점검-쿼리-예시)을 사용합니다.

---

## 8. 구현 참고

- 가드 로직: [`scripts/real_data_guard.py`](../../scripts/real_data_guard.py)
- 자동화 확장 판단: [Go/No-Go](real-data-automation-go-no-go.md)

---

## 9. 이번 저장소에서 수행한 스모크 (자동화)

- [last-smoke-validation.md](./last-smoke-validation.md) 참고.
- 운영 DB **실제 1회 수집**은 비밀·비용·알림이 있어 본 문서만으로 대체하지 않으며, 운영자가 위 순서로 직접 실행하고 [결과 템플릿](real-data-validation-report-template.md)을 채웁니다.
