# 사후 분석 (Postmortem) — AG 폭주 2026-05-21

> **표준 절차 (권장):** 새 세션부터는 [ag-safe-session.md](./ag-safe-session.md) — `npm run ag:session:start` / `checkpoint` / `rollback`.  
> 이 문서는 **2026-05-21 AG 폭주 사고의 사후 분석·수동 복구 기록**입니다. 동일 상황 재발 시 참고용으로만 사용하고, 표준 롤백이 우선입니다.

참고: `~/.gemini/antigravity/brain/bb20d288-e898-4323-8b72-deacdc528444/chat_history.md`

## 원복 기준 (Git)

| 항목 | 값 |
|------|-----|
| **안전한 코드 기준선** | `origin/main` @ `721af33` (wealth 통합·cron·Portfolio 폐기 문서까지) |
| **AG 백업** | `git stash list` → `stash@{0}: ag-session-20260521-backup` |
| **AG가 망가뜨린 영역** | 주식 상세 UI + 미커밋 시드/차트 + Vercel redeploy + **프로덕션 Turso 쓰기** |

`chat_history`의 「Knowledge 캡슐화」 시점 UI는 **커밋되지 않았습니다.** 필요 시 stash에서 파일만 골라 복구하세요.

## AG 세션 타임라인 (요약)

1. Turso / Gemini 키 Vercel 갱신 + redeploy  
2. PER/PBR/ROE/재무탭/차트 수정 (`page.tsx`, `StockDetailClient.tsx`, `StockCharts.tsx`)  
3. `update_dividends.py` + 프로덕션 DB 배당  
4. `seed_financials_only.py` 2021~2025 + Q4 합성 버그 → **FY−(Q1+Q2+Q3)** 수정  
5. Economist 테마 병합 중 `LIMIT 8` 쿼리 **회귀** → 차트 붕괴  
6. 「원상복구」 + 추가 배포 → 상태 악화  

## Q4 합성 (재시드 시 유지)

`knowledge/auto_captured_dart_q4_calculation/artifacts/details.md`:

```text
Q4 = FY − (Q1 + Q2 + Q3)
```

`main`의 `seed_financials_only.py`는 위 수식을 이미 사용합니다.

## 「DART기준으로 수정해줘」 직전 복구 (2026-05-21)

`chat_history` 기준 **가능한 최근 복구점**입니다. Git 스냅샷은 없어 `stash@{0}` + 문서 스펙으로 재구성했습니다.

| 포함 | 제외 (그 이후 AG 작업) |
|------|------------------------|
| 연간/분기 쿼리 분리, FY 기준 PER/PBR/배당/ROE | DART EPS 우선(덮어쓰기 제거) + prod re-seed |
| 재무 탭 연간 차트·연간/분기 테이블 | Economist 병합 후 `LIMIT 8` 회귀 |
| `seed` EPS = 순이익/주식수 **강제** (네이버 분석 직전) | `CashFlowAndDebtChart` (Knowledge 복구 때 추가) |
| `scripts/update_dividends.py` | 차트 「망가짐」 이후 패치·배포 |

프로덕션 DB는 AG가 DART EPS로 다시 쓴 상태일 수 있습니다. UI와 맞추려면:

```bash
REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE python3 scripts/seed_financials_only.py
```

## 실행한 원복 (2026-05-21)

```bash
git stash push -u -m "ag-session-20260521-backup"
git checkout origin/main -- \
  src/app/stocks/[ticker]/page.tsx \
  src/app/stocks/[ticker]/StockDetailClient.tsx \
  src/components/StockCharts.tsx \
  scripts/seed_financials_only.py
```

## 프로덕션 DB

코드 원복만으로 Turso 데이터는 되돌아가지 않습니다. 검증 후:

```bash
REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE python3 scripts/seed_financials_only.py
```

## Vercel

[secret-handling.md](./secret-handling.md) — Production Build Command 악성 스크립트 여부를 **대시보드에서 직접** 확인.

프로덕션 UI를 `main`과 맞추려면:

```bash
npx vercel deploy --prod --yes
```

## stash에서 일부만 복구

```bash
git checkout stash@{0}^3 -- knowledge/
git checkout stash@{0} -- scripts/update_dividends.py   # 필요 시
```
