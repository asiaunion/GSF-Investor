# GSF-Investor — Weekly Status

---

## [HUB] 프로젝트 요약 (전체 현황판용 공통 필드)

| 필드 | 값 |
|------|-----|
| 최종 업데이트 | 2026-06-21 (Cursor 검증 세션) |
| 프로젝트명 | GSF-Investor |
| 상태 | 🟡 Active — v2 기능 대부분 구현, **로컬 49파일 미커밋** · prod 마이그레이션 대기 |
| 목표 + 기한 | 6-Phase 개선 커밋·배포 → prod `holding_snapshots` 적재 → 실사용 전환 (2026-06-28) |
| 이번 주 최우선 액션 | ① 로컬 변경 커밋·push ② prod `db:migrate` + holding_snapshot 1회 ③ prod 수동 검증 |
| 다음 체크포인트 | 2026-06-28 |
| 블로커 | prod Turso 마이그레이션 — Joseph 승인 필요 (`REAL_DATA_RUN_ACK`) |

---

## 🔴 이번 주 필수 액션

| 기한 | 항목 | 상태 |
|------|------|------|
| 6/21 | `npm run build` 통과 확인 | ✅ 통과 (Cursor 2026-06-21) |
| 6/21 | `npm run test` (vitest 25건) | ✅ 전부 통과 |
| 6/21 | `npm run lint` | ✅ 통과 |
| 6/21 | 6-Phase 로컬 변경 git commit + push | ⬜ **49파일 미커밋** |
| 6/21 | prod `ag:session:checkpoint` + 수동 검증 | ⬜ 미실행 |
| 6/28 | prod `holding_snapshots` migrate + workflow_dispatch 1회 | ⬜ Joseph 승인 대기 |
| 6/28 | v2 DoD 체크리스트 최종 서명 | ⬜ 미착수 |

---

## 📊 재평가 요약 (2026-06-21 기준)

| 영역 | 등급 | 판단 |
|------|------|------|
| **기능 완성도** | A- | v2 Week 1~2 핵심 UI·API·cron 대부분 코드 존재. prod 데이터 적재만 남음 |
| **운영 안정성** | B | Telegram 크론 알림(로컬) 추가. prod 검증·ACK Secrets 이관 미완 |
| **코드 품질** | B+ | N+1 제거, `db-utils` 추출, vitest 25건. API 테스트·E2E는 부족 |
| **AI 파이프라인** | A | Gemini Search Grounding + Claude Sonnet 4.6 fallback 이중화 |
| **배포 준비** | C+ | build 통과하나 **main 마지막 커밋 6/8** — 6-Phase 작업 미푸시 |

**한 줄 결론:** 설계(v2) 대비 **구현은 ~90%**, **운영 전환(prod migrate + 커밋)은 ~40%**.

---

## 🏗️ 구현 현황

### Phase 2b (main 커밋됨 — 2026-05~06)

| 항목 | 상태 | 비고 |
|------|------|------|
| 배당 캘린더 `/dividends` | ✅ | yfinance, `pay_date` NULL 한계 |
| 기준 통화 Settings + formatMoney | ✅ | 대시보드·`/wealth` KPI |
| Discover Week 2 필터 | ✅ | return1m/3m/6m/1y, YoY 등 |
| `holding_snapshots` 스키마 + cron yml | ✅ | `holding_snapshot.py` 커밋됨 |
| `net-worth/history` API + Stacked Area | ✅ | `NetWorthHistoryChart` 대시보드 연동 |
| `/discover` 스크리너 + `?compare=` UI | ✅ | `DiscoverScreener`, `DiscoverCompare` |
| 포트폴리오 수익률 차트 | ✅ | `PortfolioPerformanceChart` (2일+ 스냅샷 필요) |

### 6-Phase 개선 (로컬 완료 — **미커밋**)

| Phase | 항목 | 상태 | 비고 |
|-------|------|------|------|
| 1 | all-scores N+1 최적화 | ✅ 로컬 | 종목당 5쿼리 → 전체 7쿼리 (`db-utils.ts`) |
| 2 | `auto_financials.py` + quarterly yml | ✅ 로컬 | KR 종목 분기 4회 자동수집 |
| 3 | Gemini Search Grounding | ✅ 로컬 | AI 보고서 최신 뉴스·공시 반영 |
| 4 | snapshot-history API + HoldingReturnChart | ✅ 로컬 | 종목 상세 수익률 추이 |
| 5 | GitHub Actions Telegram 알림 (5개 wf) | ✅ 로컬 | 크론 실패 즉시 알림 |
| 6 | `ai-provider.ts` + Claude fallback | ✅ 로컬 | Gemini 장애 시 Sonnet 4.6 |

### prod·운영 (미완)

| 항목 | 상태 | 비고 |
|------|------|------|
| prod `holding_snapshots` migrate | ⬜ | Joseph 승인 + checkpoint |
| holding_snapshot 첫 데이터 적재 | ⬜ | migrate 후 workflow_dispatch |
| `/journal` INIT 재입력 | ⬜ | 사용자 데이터 ([wealth-migration-report](docs/operations/wealth-migration-report.md)) |
| REAL_DATA_RUN_ACK → GitHub Secrets | ⬜ | yml 하드코딩 → Secrets 이관 권장 |

---

## 🗓️ 안정화 로드맵

| 단계 | 조건 | 내용 | 상태 |
|------|------|------|------|
| 0 | 6/21 | Claude Code 6-Phase 개선 (로컬) | ✅ |
| 0.5 | 6/21~22 | git commit + push + Vercel redeploy | ⬜ **최우선** |
| 1 | 6/28 | prod migrate + holding_snapshot 1회 | ⬜ |
| 2 | 1 완료 후 | prod 수동 검증 (대시보드·차트·AI 보고서) | ⬜ |
| 3 | 2 완료 후 | 실사용 전환 + Phase 3 백로그 착수 | ⬜ |

---

## 🔧 추가 개선사항 (우선순위)

### P0 — 이번 주

1. **로컬 49파일 커밋·push** — main이 6/8 이후 정지. Vercel prod가 6-Phase 미반영.
2. **prod Turso migrate** — `holding_snapshots` 테이블 생성 후 cron 데이터 누적 시작.
3. **`ag:session:checkpoint` + 수동 검증** — [real-data-manual-validation.md](docs/operations/real-data-manual-validation.md) 1회.

### P1 — 2주 내

4. **REAL_DATA_RUN_ACK Secrets 이관** — 5개 workflow yml 하드코딩 제거.
5. **포트폴리오·Compare 차트 `formatMoney` 통화 확장** — Settings base_currency와 불일치 잔존.
6. **배당 `pay_date` 보정** — SEIBRO 또는 수동 보정 + 월뷰 UI (yfinance 한계).
7. **재무 L1 DART 100%** — `validate_financials_dart.py` 기준 파서·재시딩.

### P2 — Phase 3 (합의 후)

8. **종목 상세 인라인 레이더** — Discover 레이더를 ticker 페이지로 이동.
9. **TYO·업종 레이더** — 섹터 벤치마크 DB 필요 (v2 비목표).
10. **벤치마크 정책 B/C** — 현재 A(069500) 고정. 사용자·AG 합의 전 구현 금지.
11. **API·E2E 테스트 확대** — vitest 25건 → discover/wealth cron route 커버리지.
12. **v2 spec DoD 체크박스 갱신** — [investor-upgrade-design-v2.md](docs/specs/2026-05-21-investor-upgrade-design-v2.md) §3.3·§12 미체크.

---

## 🗂️ 관련 문서

| 문서 | 용도 |
|------|------|
| [gsf-investor.vercel.app](https://gsf-investor.vercel.app) | 라이브 URL (6/8 빌드 기준) |
| [github.com/asiaunion/GSF-Investor](https://github.com/asiaunion) | 소스 코드 |
| [investor-upgrade-design-v2.md](docs/specs/2026-05-21-investor-upgrade-design-v2.md) | 구현 정본 |
| [_handoff.md](_handoff.md) | Claude Code 6-Phase 작업 기록 |
| [remaining-work.md](docs/operations/remaining-work.md) | Phase 3 백로그 |
| [phase-2b-backlog.md](docs/operations/phase-2b-backlog.md) | Week 2 완료 항목 |

---

## 📝 작업 로그

### 2026-06-21 (Cursor — 현황 검증·재평가)
- `npm run build` / `lint` / `test`(25건) 전부 통과 확인
- v2 Week 1~2 항목 코드 존재 확인 (net-worth history, discover compare, holding_snapshots)
- 6-Phase 개선 **49파일 로컬 미커밋** 확인 (main HEAD: `e04f4c5` @ 2026-06-08)
- prod migrate·첫 스냅샷 적재·수동 검증 미완 → 블로커·로드맵 갱신

### 2026-06-21 (Claude Code — 6-Phase 개선)
- Phase 1~6 로컬 완료 (상세: `_handoff.md`)

### 2026-06-09
- GSF-Hub 현황판 재설계 논의 참여
