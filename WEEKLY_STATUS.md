# GSF-Investor — Weekly Status

---

## [HUB] 프로젝트 요약 (전체 현황판용 공통 필드)

| 필드 | 값 |
|------|-----|
| 최종 업데이트 | 2026-07-13 |
| 프로젝트명 | GSF-Investor |
| 상태 | 🟢 Active — prod 안정화 완료, **v3 설계 확정** (Phase 0 착수 대기) |
| 목표 + 기한 | v3 Phase 0(데이터 신뢰) 완료 → Phase 1(리스크 대시보드) 진행 (2026 Q3) |
| 이번 주 최우선 액션 | Phase 1 & 2 UI 개편 완료 |
| 다음 체크포인트 | Cursor BRIEF 검토 후 |
| 블로커 | 없음 |

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
| **배포 준비** | A- | main 76fe367 prod 안정화. v3 방향 확정(2026-07-02) |

**한 줄 결론:** **prod 전환 완료**. v3 설계 확정, Phase 0 착수 준비 중.

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

### v3 Phase 0 (데이터 신뢰) — 착수 대기

| 항목 | 상태 | 비고 |
|------|------|------|
| **벤치마크 069500 무결성 확인** | 🔄 Cursor | KODEX 200 종목 삭제 후 alpha 파이프라인 영향 검증 |
| REAL_DATA_RUN_ACK → GitHub Secrets | ⬜ | yml 하드코딩 5개 워크플로우 제거 |
| **재무 L1 DART 100%** | ⬜ | 동서·미코 2종목 재시딩 (대상 축소) |
| **데이터 검증 배지** (신규) | ⬜ | 주요 지표에 "최종 갱신일·소스" 표시 |
| `/journal` INIT 재입력 | ⬜ | Joseph: 동서·미코 (P0-2, 유일한 데이터 작업) |

### 비용 및 기술부채 (정정)

| 항목 | 상태 | 비고 |
|------|------|------|
| KODEX 200 INIT 단가 | ❌ 해소 | KODEX 삭제 (2026-07-02) — 미결 소멸, 단가 확인 불필요 |
| v2 잔여 우선순위 | ✅ 해소 | v3 방향 확정 (2026-07-02) — Phase 0~1 로드맵 결정 |

---

## 🗓️ v3 로드맵 (2026-07-02 확정)

| 단계 | 범위 | 상태 | 기한 |
|------|------|------|------|
| **Phase 0** | 데이터 신뢰 회복 (4항목) | 🔄 착수 준비 | ~7월 말 |
| **Phase 1** | 리스크 대시보드 (자산배분·통화·부채·집중도) | ⬜ 미착수 | ~8월 |
| Phase 2 | 일본 자산 축 (NISA·TYO·부동산 평가) | 📋 설계 논점만 | 2026 Q3+ |
| Phase 3 | 의사결정 지원 (리밸런싱·AI 월간 리뷰·시나리오) | 📋 설계 사항 | Phase 1~2 안착 후 |

**v3 핵심 변경:**
- 목표: "스크리너·발굴" → **"자산 리스크·배분 관리"** (개인 의사결정 OS)
- 범위: 1인 실사용 전용 (멀티테넌트·공개 서비스화 영구 배제)
- 일본: NISA 계좌 관리 추가 (Phase 2)

---

## 🔧 추가 개선사항 (우선순위 갱신)

### P0 — Phase 0 착수 필수

1. **벤치마크 069500 무결성 확인** — Cursor (KODEX 종목 삭제 후 alpha 계산 영향 검증)
2. **REAL_DATA_RUN_ACK Secrets 이관** — yml 5개 하드코딩 제거 (기존 P1 승격)
3. **재무 L1 DART 100%** — 동서·미코 2종목 (대상 축소로 부담 경감)
4. **데이터 검증 배지** — 주요 지표에 갱신일·소스 표시 (stale 데이터 오판 방지)

### P1 — Phase 1 진행 중

5. **통화 노출 대시보드** — JPYKRW pair 추가 (Joseph 생활통화=JPY vs 자산 KRW)
6. **자산배분 뷰** — 클래스·통화·지역 비중 (기존 `v_portfolio` 확장)
7. **부채·LTV 뷰** — `stock_loans` 안전마진 모니터링
8. **집중도 경고** — 임계치 초과 시 Telegram (기존 알림 확장)

### P2 — Phase 2 (설계 중)

9. **계좌 차원 스키마** — KR vs JP NISA vs JP 課税 구분 (NISA 제도 반영 필수)
10. **NISA 枠 트래킹** — 新NISA 생애 1,800만·연간 枠 관리
11. **TYO 시세** — yfinance `.T` 티커 확장 (기존 파이프라인 활용)

### 비목표 (계속 유지)

- 멀티테넌트 · KRX/TYO 전체 스크리너 확장 · 자동매매 · 실시간 시세

---

## 🗂️ 관련 문서

| 문서 | 용도 |
|------|------|
| [gsf-investor.vercel.app](https://gsf-investor.vercel.app) | 라이브 URL |
| [github.com/asiaunion/GSF-Investor](https://github.com/asiaunion) | 소스 코드 |
| `CURSOR_BRIEF_investor-v3-phase0-1-20260702.md` | **v3 Phase 0~1 구현 브리핑** (2026-07-02) |
| [investor-upgrade-design-v2.md](docs/specs/2026-05-21-investor-upgrade-design-v2.md) | v2 구현 정본 |
| [_handoff.md](_handoff.md) | Claude Code 6-Phase 작업 기록 |
| [remaining-work.md](docs/operations/remaining-work.md) | Phase 3 백로그 |
| [phase-2b-backlog.md](docs/operations/phase-2b-backlog.md) | Week 2 완료 항목 |

---

## 📝 작업 로그

### 2026-07-13
- SWS-Style 대시보드 및 리서치 연동 배포 완료
- Portfolio UI SWS 스타일 2-column 개편 완료
- stock_thesis 리서치 컬럼 추가 및 Turso DB 연동
- Research Ticker 편집 폼 및 UPSERT API 작성
- IA Refactor (Phase 4-6) 및 배포 완료

### 2026-07-02 (Claude — v3 방향 확정)
- Joseph 결정 5건 확인: KODEX 삭제·방향 A 승인·범위 1인 전용·일본 자산 축 포함·v2 미결 해소
- v3 로드맵 재작성: Phase 0(데이터 신뢰) → Phase 1(리스크 대시보드) → Phase 2(일본 축)
- CURSOR_BRIEF_investor-v3-phase0-1-20260702.md 작성 (Phase 0 5항목·Phase 1 4기능·Phase 2 설계 논점)
- SESSION_LOG 미결 2건 해소 대상: "KODEX 200 INIT 단가 확인" · "v2 잔여 우선순위 확정"

### 2026-06-21 (Cursor — 현황 검증·재평가)
- `npm run build` / `lint` / `test`(25건) 전부 통과 확인
- v2 Week 1~2 항목 코드 존재 확인 (net-worth history, discover compare, holding_snapshots)
- 6-Phase 개선 **49파일 로컬 미커밋** 확인 (main HEAD: `e04f4c5` @ 2026-06-08)
- prod migrate·첫 스냅샷 적재·수동 검증 미완 → 블로커·로드맵 갱신

### 2026-06-21 (Claude Code — 6-Phase 개선)
- Phase 1~6 로컬 완료 (상세: `_handoff.md`)

### 2026-06-09
- GSF-Hub 현황판 재설계 논의 참여
