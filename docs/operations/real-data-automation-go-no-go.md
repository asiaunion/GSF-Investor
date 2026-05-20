# 실데이터 배치 — 자동화 확장 Go/No-Go

수동 검증 1회 이후, GitHub Actions 크론/수동 `workflow_dispatch`를 **그대로 또는 강화**해 운영해도 되는지 판단 기준입니다.

## Go (자동화 유지·확대 가능)

- 수동 런에서 **Preflight → DRY_RUN → 실쓰기** 순서가 재현되었고, 심각한 데이터 오염 없음.
- `daily_price` / `daily_dart` / `daily_sec` / `weekly_signal`이 **의도한 테이블만** 갱신함이 보고서로 확인됨.
- 실패 시 **exit code·로그**로 모니터링 가능하고, Telegram/알림이 과도하지 않음.
- 워크플로에 `REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE`가 명시되어 있어 “의도적 운영 쓰기”가 코드·리뷰로 추적 가능함.
- Turso 백업/복구 경로가 문서화되어 있음.

## No-Go (수동만 또는 스크립트 수정 후)

- DRY_RUN과 실쓰기 결과가 **일관되지 않음** (드라이 런에서는 성공인데 실쓰기에서 대량 실패 등).
- 동일 종목에 **중복 disclosures/signals**가 반복 삽입됨.
- API 할당량·비용(**Gemini**, DART/SEC/FMP)이 예산·정책 초과.
- 롤백 방법이 없고, 스크립트에 **운영 확인 프롬프트**(가드 외 추가 보호)가 부족하다고 팀이 판단함.
- `seed_*` 같은 대량 작업을 자동화에 섞었거나, 크론이 **staging이 아닌 운영**에 대해 테스트 단계 없이 즉시 실행됨.

## 권장 다음 단계 (Go 시)

1. 크론은 유지하되 한동안 **`workflow_dispatch`만 추가 검증**에 사용할지 결정합니다.  
2. 실패 알림 채널(Slack 등)을 [daily_price 워크플로 주석 블록](../../.github/workflows/daily_price.yml) 패턴으로 연결합니다.  
3. 분기별 **스테이징 Turso**(별 URL) 도입 시 동일 스크립트로 먼저 DRY_RUN/실쓰기를 반복합니다.

## 참고

- 런북: [real-data-manual-validation.md](./real-data-manual-validation.md)  
- 결과 기록: [real-data-validation-report-template.md](./real-data-validation-report-template.md)
