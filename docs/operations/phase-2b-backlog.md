# Phase 2b 백로그 (v2 Week 2 이후)

정본: [investor-upgrade-design-v2.md](../specs/2026-05-21-investor-upgrade-design-v2.md)

Week 1–2(백엔드 PR #1–#3, UI PR #4) 완료 후 남은 항목입니다.

## 배당 (`dividend_events`)

| 상태 | 내용 |
|------|------|
| 완료 | Drizzle 스키마 + prod migrate |
| 연기 | 적재 스크립트·데이터 소스 (Yahoo / SEIBRO / 수동) 미확정 |
| UI | `/dividends` empty state (Phase 2b 안내) |

**AG 착수 조건:** 데이터 소스 1개 확정 + 샘플 3종목 seed 검증.

## 기준 통화 표시 확장

| 상태 | 내용 |
|------|------|
| 완료 | `user_preferences`, Settings UI, `formatMoney` 헬퍼, 대시보드 KPI |
| 연기 | `/wealth` 전역·차트 축·JPY (`JPYKRW` in `daily_price`) |

## 벤치마크 정책 B/C

| 옵션 | 설명 |
|------|------|
| A (현재) | 069500 오버레이 (`compare-prices`) |
| B | ^KS11, ^GSPC `daily_price` 확장 |
| C | 보유 시장별 자동 선택 |

사용자·AG 합의 전 B/C 구현 금지.

## 기타 (Phase 3)

- 종목 상세 인라인 레이더
- TYO·업종 레이더
- 스냅샷 cron 실패 알림 (Telegram 등)

## 운영

- `holding_snapshots` **2일+** 쌓이면 포트폴리오 수익률 차트 자동 표시
- cron 표: [README.md](../../README.md#데이터-수집-cron-kst)
