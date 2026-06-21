# GSF-Investor — 남은 작업

**운영 체크리스트 1~5 · Portfolio 폐기 · repo rename — 완료 (2026-05-23)**  
세션 기록: [session-summary-2026-05-23.md](./session-summary-2026-05-23.md)

## 운영 1~5 (완료)

| # | 작업 | 상태 |
|---|------|------|
| 1 | `/journal` INIT | [x] |
| 2 | 대시보드 · `/wealth` | [x] |
| 3 | 순자산 cron 스모크 | [x] |
| 4 | Telegram `gsf_investor` 순자산 | [x] |
| 5 | 배당 cron Actions | [x] |

## Phase 3 / 선택 (다음에)

- **P0:** 6-Phase 로컬 변경 커밋·push + prod `holding_snapshots` migrate
- 포트폴리오 수익률·Compare 차트 `formatMoney` 통화 확장
- 배당: SEIBRO·`pay_date` 보정, 월뷰 UI
- 종목 상세 인라인 레이더, TYO·업종 레이더
- ~~cron 실패 Telegram 알림~~ → ✅ 6-Phase 로컬 (5 workflows, 미커밋)
- 재무 L1 DART 100% (파서·재시딩)
- 벤치마크 정책 B/C (합의 전 금지)
- REAL_DATA_RUN_ACK → GitHub Secrets 이관

## 참고

- [phase-2b-backlog.md](./phase-2b-backlog.md)
- [portfolio-decommission.md](./portfolio-decommission.md)
- [telegram-net-worth-alert.md](./telegram-net-worth-alert.md)
- [investor-upgrade-design-v2.md](../specs/2026-05-21-investor-upgrade-design-v2.md)
