# GitHub 저장소 이름: `GSF-Investor`

다른 asiaunion 프로젝트(`GSF-Portfolio`, `GSF-Blog` 등)와 동일한 대문자 규칙으로 통일합니다.

## 1. GitHub에서 이름 변경 (필수, 1회)

1. https://github.com/asiaunion/gsf-investor/settings → **Repository name**
2. `GSF-Investor` 로 변경 후 저장

또는 로컬에서 `gh auth login` 후:

```bash
gh repo rename GSF-Investor -R asiaunion/gsf-investor
```

GitHub는 이전 URL(`gsf-investor`)을 자동으로 리다이렉트합니다.

## 2. 로컬 remote 갱신

```bash
cd /Users/gsf/.gemini/antigravity/scratch/projects/GSF-Investor
git remote set-url origin git@github.com:asiaunion/GSF-Investor.git
git fetch origin
```

## 3. Cursor symlink (이미 적용된 경우 생략)

```bash
cd /Users/gsf/dev/Cursor
rm -f gsf-investor
ln -sfn /Users/gsf/.gemini/antigravity/scratch/projects/GSF-Investor GSF-Investor
```

`GSF.code-workspace`의 `GSF-Investor` 폴더는 `GSF-Investor` 경로를 가리킵니다.

## 변경하지 않는 것

| 항목 | 이유 |
|------|------|
| Turso DB `gsf-investor` | 인프라 이름; rename 시 URL·토큰 전부 재발급 |
| Vercel 프로젝트 `gsf-investor` | 배포 URL `gsf-investor.vercel.app` 유지 |
| `package.json` `name` | npm 패키지 식별자(소문자 관례) |
| `preview@gsf-investor.local` | 내부 프리뷰 사용자 |
