# AG 세션 원복 가이드 (2026-05-21)

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
