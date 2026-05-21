# AG에게 붙여 넣을 프롬프트 (복사용)

GSF-Investor 작업 시 Antigravity·Cursor에 **그대로 복사**해 사용하세요.  
에이전트는 [ag-safe-session-for-ag.md](./ag-safe-session-for-ag.md) 전체 흐름을 따릅니다.

---

## 1) 세션 시작 (가장 먼저, 작업 전 1회)

```
GSF-Investor 작업을 시작한다. AG Safe Session 절차를 따른다.

1) docs/operations/ag-safe-session-for-ag.md 를 읽고 전체 흐름을 이해한다.
2) npm run ag:session:status 로 세션 여부를 확인하고, 없으면 npm run ag:session:start 를 실행한다.
3) 현재 브랜치·체크포인트·Turso 백업 경로를 한 줄로 보고한 뒤, 내가 요청한 작업을 시작한다.

main 브랜치에서 직접 수정·커밋하지 않는다.
```

---

## 2) 일반 작업 (기능·UI·스크립트)

```
이번 요청만 AG Safe Session 브랜치(ui/ag-*)에서 진행한다.
작업 전 ag:session:status 로 세션이 살아 있는지 확인한다.
완료 후 변경 요약과, prod 배포/DB 쓰기가 필요한지 여부를 알려준다.
```

---

## 3) 프로덕션 배포 전

```
프로덕션 배포 전 AG Safe Session 체크포인트를 갱신한다.
순서: npm run ag:session:checkpoint → npm run build → npx vercel deploy --prod --yes
각 단계 성공/실패를 보고한다. checkpoint 없이 deploy 하지 않는다.
```

---

## 4) 프로덕션 Turso 시드/갱신 전

```
프로덕션 Turso 쓰기 전 AG Safe Session 체크포인트를 갱신한다.
순서: npm run ag:session:checkpoint → (필요 시) REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE python3 scripts/...
실행할 정확한 스크립트와 이유를 먼저 말하고, 내 확인 후 실행한다.
```

---

## 5) 뭔가 잘못됐을 때 (롤백)

```
지금 상태가 잘못됐다. AG Safe Session 기준으로 롤백한다.

1) npm run ag:session:rollback -- --all --dry-run 결과를 요약한다.
2) 내가 확인하면 npm run ag:session:rollback -- --all --yes 를 실행한다.
3) git checkout origin/main -- 개별 파일 방식은 쓰지 않는다.
4) 롤백 후 ag:session:status 와 프로덕션 URL을 보고한다.
```

---

## 6) 디자인/UI 확정 후

```
UI/디자인이 확정됐다. AG Safe Session 체크포인트를 갱신하고,
필요하면 scripts/snapshot.sh 로 승인 스냅샷도 남긴다.
이후 이 상태를 기준선으로 보고한다.
```

---

## 7) Antigravity 전용 (Cursor 훅 없을 때)

```
이 프로젝트는 AG Safe Session 규칙이 있다.
Cursor 훅이 없으므로, 세션 시작·checkpoint·롤백을 전부 네가 직접 npm 스크립트로 실행한다.
규칙: docs/operations/ag-safe-session-for-ag.md, AGENTS.md
절대 main 에서 작업하지 말고, Vercel 대시보드 browser MCP 로 시크릿을 가져오지 마라.
```

---

## 8) 짧은 한 줄 (이미 세션 중)

| 상황 | 프롬프트 |
|------|----------|
| 상태 확인 | `ag:session:status 보고해줘` |
| 체크포인트 | `배포/ prod DB 전 checkpoint 갱신해줘` |
| 롤백 | `ag:session:rollback --all --dry-run 먼저` |
