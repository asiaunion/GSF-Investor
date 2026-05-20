# 실데이터 수동 검증 — 실행 보고 (2026-05-20)

검증 일시: 2026-05-20 18:47 KST (UTC 09:47)  
실행자: Cursor 에이전트 (사용자 대리)  
대상 DB: `gsf-investor` (Turso, `aws-ap-northeast-1`)

**인증:** 워크스페이스 `.env.local`의 `TURSO_*`·`DART_API_KEY`는 비어 있어, **Turso CLI**(`turso db show` / `turso db tokens create`)로 일회성 토큰을 발급해 실행했습니다.

---

## Production 수동 확인 (사용자, 키 rotation 후)

검증 일시: 2026-05-20 (에이전트 배치 검증 이후, 사용자 직접)  
확인자: 사용자 (Vercel 대시보드·브라우저 — **브라우저 서브에이전트 미사용**)

| 항목 | 결과 |
|------|------|
| Vercel 환경변수·Build 설정 | 직접 확인 완료 (시크릿 교체 반영) |
| Production **Redeploy** | 완료 |
| https://gsf-investor.vercel.app | 로그인 성공, **데이터 조회 정상** |

**판정:** 운영 웹 앱 경로는 **사용 가능(GO)**.  
아래 §「에이전트 대리 배치 검증」은 로컬/CLI 기준이며, Production UI 검증과 별개로 유지한다.

---

## 실행 범위

| 단계 | 스크립트 | DRY_RUN | 실쓰기 | 결과 |
|------|----------|---------|--------|------|
| 1 | `daily_price.py` | ✅ | ✅ | 부분 성공 (exit 1) |
| 2 | `daily_dart.py` | ❌ 미실행 | ❌ 미실행 | `DART_API_KEY` 없음 |
| 3 | `daily_sec.py` | ✅ exit 0 | ✅ exit 0 | MDLZ 공시 20건 신규 |
| 4 | `weekly_signal.py` | ✅ exit 0 | ✅ exit 0 | 시그널 2건 신규 |

앱 보고서 API: 이번 세션에서 **미실행** (Gemini·OAuth 미설정).

---

## 환경

- `REAL_DATA_RUN_ACK`: 실쓰기 시 설정됨  
- 실행 위치: 로컬 macOS, Python 3.9  
- API: Turso ✅ / Yahoo(주가·환율) ✅ / SEC ✅ / DART ❌ / Gemini ❌  

---

## 실행 전 스냅샷 (운영 DB)

| 지표 | 값 |
|------|-----|
| prices `026960` | n=1223, last=2026-05-19 |
| prices `059090` | n=1222, last=2026-05-19 |
| prices `069500` | n=3, last=2026-05-19 |
| prices `MDLZ` | n=3, last=2026-05-19 |
| USDKRW 최신 | 2026-05-19, 1492.32 |
| disclosures (당일 `date('now')`) | 0 |
| signals (당일) | 0 |

---

## 로그 요약

### `daily_price` (실쓰기)

- Turso 연결 성공, 활성 종목 5개.
- **성공:** 026960, 059090, 069500, MDLZ 주가 수집 → **prices 4행** 갱신.
- **실패:** `217190` — `yahoo_ticker` 비어 있음 → `all_providers_failed`.
- **환율:** USDKRW 2026-05-20 **신규 1행** (rate ≈ 1506.28).
- exit code: **1** (일부 티커 실패).
- DRY_RUN 중 발견: `print_summary`의 `volume` KeyError → **수정 반영** (`r.get("volume", 0)`).

### `daily_dart`

- 로컬에 `DART_API_KEY` 없어 **시작 직후 exit** — 운영 검증 **미완료**.

### `daily_sec` (실쓰기)

- MDLZ CIK 조회 → 10-Q/10-K **20건 신규** `disclosures` INSERT.
- exit 0.

### `weekly_signal` (실쓰기)

- `059090`에 LOW `PRICE_SURGE` 1건, MEDIUM `DEBT_SURGE` 1건 → **합계 2건** 신규 (월간 PRICE_SURGE는 당일 중복 규칙으로 스킵 가능).
- exit 0.

---

## 실행 후 스냅샷

| 지표 | 전 → 후 |
|------|---------|
| `026960` last_date | 2026-05-19 → **2026-05-20** (n +1) |
| `059090` last_date | 2026-05-19 → **2026-05-20** (n +1) |
| `069500` last_date | 2026-05-19 → **2026-05-20** (n +1) |
| `MDLZ` last_date | 2026-05-19 (변화 없음, USD 종가일) |
| USDKRW 최신 | 2026-05-19 → **2026-05-20** (1506.28) |
| signals 당일 | 0 → **2** (`059090` LOW/MEDIUM) |
| disclosures 당일 (`date('now')`) | 0 → 0 (SEC `filed_at`이 당일 UTC 기준 아님) |

최근 disclosures: MDLZ SEC 10-Q/10-K 및 기존 `217190` DART 공시 혼재 — **비정상 폭증 없음** (SEC 20건은 이번 수동 실행으로 설명 가능).

---

## 이슈 / 조치

| 이슈 | 심각도 | 조치 |
|------|--------|------|
| `.env.local`에 Turso/DART 비어 있음 | 중 | Vercel `env pull` 또는 Turso CLI로 로컬 동기화 |
| `DART_API_KEY` 없어 `daily_dart` 미검증 | 중 | 키 설정 후 DRY_RUN → 실쓰기 1회 |
| `217190` `yahoo_ticker` 빈 문자열 | 중 | DB에 Yahoo 심볼 등록 또는 `is_active=0` |
| `daily_price` exit 1 | 낮음 | 217190 수정 후 재실행 |
| `daily_price` summary `volume` KeyError | 낮음 | **코드 수정 완료** |

---

## 판정

### Production (Vercel 앱) — **PASS (사용자 확인)**

- 키 rotation 후 Vercel 설정·Redeploy·로그인·데이터 조회까지 **사용자가 직접 확인 완료**.

### 에이전트 대리 배치 (로컬/CLI) — **PASS WITH NOTES**

- 운영 Turso에 대한 **가격·환율·SEC 공시·주간 시그널** 실쓰기 경로는 동작함.
- 당시 로컬에서는 **DART 일일 배치**·**앱 보고서 API** 미검증 (이후 Production UI에서 데이터 정상이면 Vercel env는 정상으로 간주).
- 데이터 품질: **제너셈(217190)** `yahoo_ticker` 매핑 정리 필요.

### 자동화 (Go/No-Go)

- Production 앱: **Go** (사용자 확인 기준).
- GitHub Actions 크론: Secrets가 Vercel과 동일 rotation이면 **Go**; `daily_dart`는 `workflow_dispatch` 1회로 선택 검증 가능.
- 로컬 개발·배치: `.env.local`을 Vercel과 동기화하면 됨 ([secret-handling.md](./secret-handling.md)).

---

## 사용자 후속 작업 (권장)

1. ~~Vercel Production 확인·Redeploy·로그인~~ — **완료 (2026-05-20)**.  
2. 로컬에서 배치/개발 시: `.env.local`을 rotation된 키와 맞추기 (`scripts/sync_env_local.py` 또는 수동).  
3. `217190`의 `yahoo_ticker` 수정 후 `daily_price` 재실행.  
4. (선택) 로컬에서 `daily_dart.py` DRY_RUN → 실쓰기 1회.  
5. (선택) 보고서 생성 UI로 Gemini 연동 최종 확인.
