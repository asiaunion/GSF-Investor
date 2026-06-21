# GSF-Investor — _handoff.md
> Claude Code 작업 결과 기록 (Claude.ai 부트 시 §7A 읽기)
> 마지막 갱신: 2026-06-21

---

## 2026-06-21 — Claude Code 6-Phase 개선 완료

| Phase | 작업 내용 | 효과 |
|-------|-----------|------|
| 1 | all-scores N+1 쿼리 최적화 | 종목당 5쿼리 → 전체 7쿼리 (배치) |
| 2 | auto_financials.py 신규 + quarterly_financials.yml | DB의 모든 KR 종목 재무 자동 수집 (분기 4회 크론) |
| 3 | Gemini Search Grounding + 프롬프트 업데이트 | AI 보고서에 최신 뉴스·시황·공시 반영 |
| 4 | snapshot-history API + HoldingReturnChart | 종목 상세 → 보유 수익률 추이 차트 |
| 5 | GitHub Actions 5개 워크플로우 Telegram 알림 추가 | 크론 실패 즉시 알림 |
| 6 | ai-provider.ts + Claude fallback in generate/route.ts | Gemini 장애 시 Claude Sonnet 4.6 자동 전환 |

---

## holding_snapshots 파이프라인 검증 완료 (2026-06-21)

| 항목 | 상태 | 비고 |
|------|------|------|
| 스키마 정의 (schema.ts:210) | 완료 | uniqueIndex on (stock_id, date) |
| holding_snapshot.py | 완료 | v_portfolio + stocks 방어 JOIN, INSERT OR REPLACE, REAL_DATA_RUN_ACK 가드 |
| holding_snapshot.yml | 완료 | KST 18:00 평일 크론, workflow_dispatch, REAL_DATA_RUN_ACK 하드코딩 (향후 Secrets 이관 권장) |
| snapshot-history API | 완료 | holding_snapshots 테이블 직접 조회, returnPct 파생 계산 |
| HoldingReturnChart UI | 완료 | Phase 4 |
| DB 마이그레이션 (로컬) | 미확인 | sqlite3 local.db ".tables" 확인 필요 |
| prod 마이그레이션 | ✅ 완료 | prod `holding_snapshots` 테이블 존재 (86 rows, 2026-06-21) |
| 첫 데이터 적재 | ✅ 완료 | 2026-06-21 4종목 스냅샷 적재됨 |

### 다음 액션 순서
1. 로컬: sqlite3 local.db ".tables" | grep snapshot → 없으면 db:generate + db:migrate
2. 로컬: DRY_RUN=1 python3 scripts/holding_snapshot.py — 종가·환산값 확인
3. prod: ag:session:checkpoint → REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE npm run db:migrate
4. GitHub Actions → holding_snapshot.yml → workflow_dispatch 수동 1회 실행
5. 종목 상세 → HoldingReturnChart 데이터 표시 확인

### 주의 사항
- REAL_DATA_RUN_ACK가 yml에 하드코딩 — 현재 허용 가능 수준이나 향후 GitHub Secrets 이관 권장
- v2 스펙 잔여: UI 수동 검증(B.5), CRON_SECRET 스모크, P1 백로그

---

## 2026-06-21 — Cursor 후속 (커밋·CI·prod 검증)

| 항목 | 결과 |
|------|------|
| 커밋·push | `2990a52` 6-Phase, `1071897` CI/YAML fix |
| prod holding_snapshots | 86 rows, 오늘 4건 — migrate 불필요 |
| ag:session:checkpoint | 2026-06-21 갱신, Vercel dpl_CKjwfbNac… |
| CI 수정 | workflow YAML + package-lock vitest@3 sync |
| 미완 | B.5 #4·#5·#8(통화 변경), CRON_SECRET 스모크, Telegram Secrets |
| **B.5 prod UI** | ✅ 6/8 + 추가 7페이지 (2026-06-21 Joseph 스크린샷) |
| **B.7 포트폴리오 차트** | ✅ 2일+ 스냅샷·수익률 라인 확인 |

---

## [2026-06-21 세션 종료] Cursor — GSF-Investor prod 안정화

- **커밋:** `2990a52` → `e04e548` → `76fe367` (main push 완료, CI ✅)
- **prod:** holding_snapshots 86 rows, AI 보고서·Compare·대시보드 등 Joseph UI 검증
- **B.5:** **8/8 완료** — #8 USD/JPY 통화 변경 → 대시보드 KPI·순자산 차트 Y축 반영 확인
- **스크리너:** KRX 전체 아님 = 등록 관심종목(4활성)만 — UI 안내 문구 반영 (`76fe367`)
- **미완:** CRON_SECRET 스모크, Telegram Secrets UI 확인, P2(시그널 KPI·배당 집계·MDLZ 통화)
- **다음 세션:** `docs/operations/prod-deploy-checklist-2026-06-21.md` §B.6·#8
- **Claude 부재:** Cursor 단독 세션
