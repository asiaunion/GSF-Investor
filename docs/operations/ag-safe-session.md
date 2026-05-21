# AG 안전 세션 및 Full-Stack 롤백

Antigravity(AG)·Cursor 등 자율 에이전트가 **코드 + Turso + Vercel**을 한 세션에서 건드릴 때, 복구 지점을 기계적으로 남기고 되돌리기 위한 표준 절차입니다.

사후 수동 복구: [ag-postmortem-2026-05-21.md](./ag-postmortem-2026-05-21.md) (AG 폭주 **이후** 참고).

---

## 빠른 참조

| 단계 | 명령 |
|------|------|
| 세션 시작 | `npm run ag:session:start` |
| 배포·prod DB **직전** | `npm run ag:session:checkpoint` |
| 상태 확인 | `npm run ag:session:status` |
| 롤백 (전체) | `npm run ag:session:rollback -- --all --yes` |
| 롤백 (코드만) | `npm run ag:session:rollback -- --code --yes` |
| 롤백 (DB) | `npm run ag:session:rollback -- --db --yes` |
| 롤백 (Vercel) | `npm run ag:session:rollback -- --deploy --yes` |
| 드라이런 | `npm run ag:session:rollback -- --all --dry-run` |

매니페스트: `.ag-session.json` (gitignore)  
Turso 백업: `backups/ag-sessions/<session_id>.db` (gitignore)

**에이전트용 흐름·복사 프롬프트:** [ag-safe-session-for-ag.md](./ag-safe-session-for-ag.md), [ag-prompts-ko.md](./ag-prompts-ko.md)

---

## 자동화 (Cursor)

이 레포를 Cursor로 열면 **수동 입력 없이** 대부분 처리됩니다.

| 시점 | 자동 동작 |
|------|-----------|
| Cursor 대화 **세션 시작** | `.ag-session.json` 없을 때 → `npm run ag:session:start` |
| **prod DB / deploy** shell 직전 | `npm run ag:session:checkpoint` (훅) |

설정: `.cursor/hooks.json`. Antigravity만 사용 시 → [ag-prompts-ko.md](./ag-prompts-ko.md) 프롬프트로 동일 절차 지시.

---

## 세션 시작 (`ag:session:start`)

1. 미커밋 변경이 있으면 자동 `git stash` (메시지 `ag-session-autostash-*`)
2. `ui/ag-YYYYMMDD_HHMMSS` 브랜치 생성·체크아웃
3. annotated tag `checkpoint/before-<session_id>`
4. `turso db export gsf-investor` → `backups/ag-sessions/<session_id>.db`
5. `.ag-session.json` 초기화

> **Turso export 실패 시**: 기본적으로 `exit 1`로 세션 시작을 거부합니다 (DB 없이 시작하면 `--db` 롤백 불가).  
> 로컬 Turso 미설치 등 의도적으로 건너뛰려면: `AG_ALLOW_NO_DB_BACKUP=1 npm run ag:session:start`

**규칙:** `main`에서 직접 작업하지 않습니다 ([pre-push hook](../../.git/hooks/pre-push)과 동일).

---

## 체크포인트 (`ag:session:checkpoint`)

다음 **직전**에 반드시 실행:

- `REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE` 가 필요한 스크립트 (`seed_financials_only.py` 등)
- `npx vercel deploy --prod`
- `turso db import` — 프로덕션 DB 데이터 일괄 교체
- `turso db execute` — 프로덕션 DB 직접 SQL 실행 (단일 쿼리도 포함)
- `turso db shell` — 프로덕션 DB 대화형 접속 (세션 중 임의 쓰기 가능)

체크포인트가 갱신하는 것:

- tag `checkpoint/ag-<session_id>`
- Turso export 재생성
- 현재 Production Vercel deployment URL·ID
- manifest `checkpointed: true`

`real_data_guard`는 manifest가 있고 `checkpointed`가 아니면 원격 Turso 쓰기를 거부합니다 (로컬 `file:` DB 제외).

---

## 롤백 (`ag:session:rollback`)

| 플래그 | 동작 |
|--------|------|
| `--code` | `git reset --hard <checkpoint_tag>` |
| `--db` | PIT `turso db branch` (checkpoint ISO) 또는 export `turso db import` |
| `--deploy` | `npx vercel rollback <deployment_url\|id> --yes` |
| `--all` | 위 세 가지 순서대로 |
| `--dry-run` | 실행 없이 계획만 출력 |
| `--yes` | 확인 없이 적용 (`--db` / `--code` / `--deploy` 필수) |

### Turso 롤백 주의

- **import**는 새 DB 이름으로 생성됩니다. Production `gsf-investor` URL을 바꾸려면 Vercel `TURSO_DATABASE_URL` 수동 갱신이 필요할 수 있습니다.
- **branch --timestamp**는 복구용 **별도 DB**를 만듭니다. URL 출력 후 필요 시 Vercel에 반영합니다.
- 롤백 구간에 **GitHub Actions cron**이 쓰기를 했다면, DB 시점이 어긋날 수 있습니다 → 롤백 후 [real-data-manual-validation.md](./real-data-manual-validation.md) 참고.

### 코드 롤백 주의

- 부분 `git checkout origin/main -- <file>` **금지** (상태 악화 사례 다수). 항상 manifest tag 기준 `ag:session:rollback --code`.

---

## 에이전트 자율 범위

| 허용 | 금지 |
|------|------|
| feature 브랜치에서 UI·스크립트 수정 | `main` push·작업 |
| `DRY_RUN=1`, `npm run build` | 체크포인트 없는 prod Turso 쓰기 |
| checkpoint 후 prod seed·deploy | browser MCP로 Vercel 시크릿·Build Command 조작 |
| `ag:session:rollback`으로 복구 | 임의 re-seed로 “원상복구” 시도 |

시크릿: [secret-handling.md](./secret-handling.md)

---

## 글로벌 AG 지침

다른 워크스페이스에서도 동일 프로토콜을 쓰려면 [ag-global-rules-snippet.md](./ag-global-rules-snippet.md)를 Antigravity/Cursor user rules에 붙여 넣습니다.

---

## 관련 파일

- `scripts/ag_session_start.sh`
- `scripts/ag_session_checkpoint.sh`
- `scripts/ag_session_rollback.sh`
- `scripts/ag_session_status.sh`
- `scripts/ag_session_manifest.py`
- `scripts/real_data_guard.py`
- [AGENTS.md](../../AGENTS.md)
