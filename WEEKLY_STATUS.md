# GSF-Investor — Weekly Status

---

## [HUB] 프로젝트 요약 (전체 현황판용 공통 필드)

| 필드 | 값 |
|------|-----|
| 최종 업데이트 | 2026-06-23 (세션 Q — prod 완료 현황 반영) |
| 프로젝트명 | GSF-Investor |
| 상태 | 🟢 Active — prod 안정화 완료, v2 잔여 항목 대기 |
| 목표 + 기한 | v2 잔여 항목 우선순위 확정 후 실사용 전환 (2026 Q3) |
| 이번 주 최우선 액션 | KODEX 200 INIT 단가 확인 + v2 잔여 항목 우선순위 확정 |
| 다음 체크포인트 | Joseph 의사결정 후 |
| 블로커 | 없음 (prod migrate ✅, 커밋✅ 확인됨) |

---

## 🔴 이번 주 필수 액션

| 기한 | 항목 | 상태 |
|------|------|------|
| 6/21 | `npm run build` 통과 확인 | ✅ 통과 (Cursor 2026-06-21) |
| 6/21 | `npm run test` (vitest 25건) | ✅ 전부 통과 |
| 6/21 | `npm run lint` | ✅ 통과 |
| 6/21 | 6-Phase 로컬 변경 git commit + push | ✅ 완료 (2990a52→76fe367) |
| 6/21 | prod `holding_snapshots` migrate + 첫 데이터 적재 | ✅ 완료 (86 rows, 4종목) |
| 6/21 | prod ag:session:checkpoint + 수동 검증 (B.5 8/8) | ✅ 완료 |

---

## 📊 재평가 요약 (2026-06-23 기준)

| 영역 | 등급 | 판단 |
|------|------|------|
| **기능 완성도** | A | v2 Week 1~2 + 6-Phase 핵심 UI·API·cron prod 반영 (76fe367) |
| **운영 안정성** | B+ | prod migrate·B.5 UI 8/8 검증 완료. CRON_SECRET smoke 클로즈 |
| **코드 품질** | B+ | N+1 제거, `db-utils` 추출, vitest 25건. API 테스트·E2E는 부족 |
| **AI 파이프라인** | A | Gemini Search Grounding + Claude Sonnet 4.6 fallback 이중화 |
| **배포 준비** | A- | main 76fe367 prod 안정화. v2 잔여(net-worth chart·/discover) 우선순위 미결 |

**한 줄 결론:** **prod 전환 완료**. v2 잔여 항목·KODEX 200 INIT 단가 확인은 Joseph 의사결정 대기.

---

## 🏗️ 구현 현황

### Phase 2b + 6-Phase (main 커밋됨 — 76fe367)

| 항목 | 상태 | 비고 |
|------|------|------|
| 배당 캘린더 `/dividends` | ✅ | yfinance, `pay_date` NULL 한계 |
| 기준 통화 Settings + formatMoney | ✅ | 대시보드·`/wealth` KPI |
| Discover Week 2 필터 | ✅ | return1m/3m/6m/1y, YoY 등 |
| `holding_snapshots` 스키마 + cron yml | ✅ | prod migrate 완료 (86 rows, 4종목) |
| `net-worth/history` API + Stacked Area | ✅ | `NetWorthHistoryChart` 대시보드 연동 |
| `/discover` 스크리너 + `?compare=` UI | ✅ | `DiscoverScreener`, `DiscoverCompare` |
| 포트폴리오 수익률 차트 | ✅ | `PortfolioPerformanceChart` (2일+ 스냅샷 필요) |
| all-scores N+1 최적화 | ✅ | `db-utils.ts` |
| `auto_financials.py` + quarterly yml | ✅ | KR 종목 분기 4회 자동수집 |
| Gemini Search Grounding | ✅ | AI 보고서 최신 뉴스·공시 반영 |
| snapshot-history API + HoldingReturnChart | ✅ | 종목 상세 수익률 추이 |
| GitHub Actions Telegram 알림 (5개 wf) | ✅ | 크론 실패 즉시 알림 |
| `ai-provider.ts` + Claude fallback | ✅ | Gemini 장애 시 Sonnet 4.6 |

### prod·운영 (잔여)

| 항목 | 상태 | 비고 |
|------|------|------|
| prod `holding_snapshots` migrate | ✅ | 86 rows, 4종목 (6/21) |
| holding_snapshot 첫 데이터 적재 | ✅ | migrate 후 workflow_dispatch 완료 |
| `/journal` INIT 재입력 | ⬜ | 사용자 데이터 ([wealth-migration-report](docs/operations/wealth-migration-report.md)) |
| REAL_DATA_RUN_ACK → GitHub Secrets | ⬜ | yml 하드코딩 → Secrets 이관 권장 |
| CRON_SECRET smoke | ❌ 클로즈 | Vercel Sensitive 재열람 안 함 — Joseph 2026-06-23 확정 |
| KODEX 200 INIT 단가 | ⬜ | +634% 오류 가능 — Joseph 직접 확인 |

---

## 🗓️ 안정화 로드맵

| 단계 | 조건 | 내용 | 상태 |
|------|------|------|------|
| 0 | 6/21 | Claude Code 6-Phase 개선 (로컬) | ✅ |
| 0.5 | 6/21~22 | git commit + push + Vercel redeploy | ✅ (76fe367) |
| 1 | 6/28 | prod migrate + holding_snapshot 1회 | ✅ (86 rows) |
| 2 | 1 완료 후 | prod 수동 검증 (대시보드·차트·AI 보고서) | ✅ (B.5 8/8) |
| 3 | 2 완료 후 | v2 잔여 우선순위 확정 + 실사용 전환 | ⬜ Joseph 대기 |

---

## 🔧 추가 개선사항 (우선순위)

### P0 — Joseph 의사결정

1. **KODEX 200 INIT 단가 확인** — +634% 오류 가능.
2. **v2 잔여 우선순위** — net-worth Stacked Area chart vs `/discover` 스크리너.

### P1 — 2주 내

3. **REAL_DATA_RUN_ACK Secrets 이관** — 5개 workflow yml 하드코딩 제거.
4. **포트폴리오·Compare 차트 `formatMoney` 통화 확장** — Settings base_currency와 불일치 잔존.
5. **배당 `pay_date` 보정** — SEIBRO 또는 수동 보정 + 월뷰 UI (yfinance 한계).
6. **재무 L1 DART 100%** — `validate_financials_dart.py` 기준 파서·재시딩.

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
