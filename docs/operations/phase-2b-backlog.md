# Phase 2b 백로그 (v2 Week 2 이후)

정본: [investor-upgrade-design-v2.md](../specs/2026-05-21-investor-upgrade-design-v2.md)

## 배당 (`dividend_events`)

| 상태 | 내용 |
|------|------|
| 완료 | Drizzle 스키마 + prod migrate |
| 완료 | `scripts/update_dividend_calendar.py` (yfinance, 2024-01-01~) |
| 완료 | `.github/workflows/update_dividend_calendar.yml` (일요일 22:00 KST) |
| 완료 | `/dividends` 목록 UI (예정/지난/전체, 보유 필터, 추정 배당금) |
| 한계 | `pay_date` — yfinance 미제공 → NULL |
| 선택 | SEIBRO·수동 보정, 캘린더 월뷰 UI |

**운영:** workflow_dispatch 또는 주간 cron 후 `/dividends`에서 건수 확인.

## 기준 통화 표시 확장

| 상태 | 내용 |
|------|------|
| 완료 | `user_preferences`, Settings UI, `formatMoney`, 대시보드 KPI |
| 완료 | `/wealth` KPI·자산 구성·항목 금액 (`fetchDisplayCurrency`) |
| 완료 | `daily_price.py` → `JPYKRW` pair 적재 (Yahoo `JPYKRW=X`) |
| 완료 | 대시보드 순자산 차트 Y축·툴팁 (`NetWorthHistoryChart` + `formatChartAxisKrw`) |
| 연기 | 포트폴리오 수익률·Compare 등 나머지 Recharts |

## 벤치마크 정책 B/C

사용자·AG 합의 전 B/C 구현 금지. 현재 **A (069500)**.

## Discover Week 2 필터

| 상태 | 내용 |
|------|------|
| 완료 | `return1m/3m/6m/1y`, `pctFrom52wHigh`, `revenueYoY`, `epsYoY` — `screener-metrics.ts` + screen API + UI |

## 기타 (Phase 3)

- 종목 상세 인라인 레이더
- TYO·업종 레이더
- 스냅샷 cron 실패 알림 (Telegram 등)

## 운영

- `holding_snapshots` **2일+** → 포트폴리오 수익률 차트 표시
- [wealth-migration-report.md](./wealth-migration-report.md) — 일지 재입력 2단계 컷오버
- [portfolio-decommission.md](./portfolio-decommission.md) — GitHub archive (수동)
- cron 표: [README.md](../../README.md#데이터-수집-cron-kst)
