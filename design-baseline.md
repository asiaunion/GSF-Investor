# GSF-Investor Design Baseline

> 이 파일은 사용자가 승인한 디자인 사양의 영구 기록입니다.
> 에이전트는 UI 작업 시작 전 **반드시 이 파일을 먼저 읽어야** 합니다.

Last Updated: 2026-05-18
Status: ✅ 준수 (종목 상세·매매 일지 폼 economist-ui 토큰 정렬 완료)

---

## 1. 디자인 철학

- **레퍼런스**: The Economist 매거진의 에디토리얼 디자인
- **핵심 키워드**: 전문성, 절제, 톤온톤, 고급 편집 매체 감성
- **컬러 전략**: Forest Green (#2E633F) 시그니처 + 모노톤 배색
- **라이트/다크 모드**: 시스템 설정 자동 전환 + 수동 토글 지원

## 2. 핵심 시각 요소 (수정/삭제 금지)

| # | 요소 | 사양 | 비고 |
|---|---|---|---|
| 1 | **섹션 구분선** | 보유종목/대출현황/최근시그널 사이 그린 가로선 `border-t-4 border-brand-green` | Economist Red Line 모티브 |
| 2 | **카드 상단 보더** | 모든 대시보드 카드에 `border-t-4` 그린 상단 라인 | 페이지 전체 통일 |
| 3 | **다크모드 토글** | Navbar 우측에 해/달 아이콘 토글 버튼 | ThemeToggle 컴포넌트 |
| 4 | **G 아이콘** | 좌상단 네비게이션, 홈 링크 역할, 고급 타이포 | 단순 CSS 원 아님 |
| 5 | **탭 활성 상태** | 선택된 탭 = font-bold + 그린 텍스트 + 연한 그린 배경 | 라이트/다크 모두 |
| 6 | **수익/손실 색상** | 수익 = Muted Olive (차분한 초록), 손실 = Terracotta (차분한 적색) | 네온 금지 |
| 7 | **차트 그레이** | Slate Gray 계열 (배경에 묻히지 않는 밝은 톤) | #78828A / #9CA3AF (라이트), #AAB3BB / #CBD5E1 (다크) |

## 3. 컬러 토큰 사양

### 라이트 모드 (기본)
```
--color-bg-base: #F9F8F6         (따뜻한 크림 베이지)
--color-bg-surface: #F2EFEA      (카드 배경, 미세하게 어두운 베이지)
--color-text-primary: #1a1a1a    (거의 검정)
--color-text-secondary: #6b7280  (중간 회색)
--color-brand-green: #2E633F     (Forest Green 시그니처)
--color-accent-green: #4A7C59    (밝은 그린 보조)
```

### 다크 모드
```
--color-bg-base: #0f1419         (Deep Slate)
--color-bg-surface: #1a2332      (카드 배경)
--color-text-primary: #e8e6e3    (밝은 오프화이트)
--color-text-secondary: #9ca3af  (밝은 회색)
--color-brand-green: #6BA87C     (Sage Green, 다크 배경에서 시인성 확보)
--color-accent-green: #5B9A6B    (보조 그린)
```

## 4. 타이포그래피

- **본문**: 시스템 산세리프 (기본)
- **강조**: Serif 혼용 권장 (선택적)
- **수치 데이터**: Tabular Nums (고정폭 숫자)

## 5. 페이지별 일관성 체크리스트

- [x] 대시보드 (/): 카드 상단 보더, 섹션 구분선
- [x] 관심종목 (/stocks): 동일 카드 스타일
- [x] 공시 (/disclosures): 동일 카드 스타일
- [x] 시그널 (/signals): 동일 카드 스타일
- [x] 매매일지 (/journal): 동일 카드 스타일
- [x] AI 보고서 (/reports): 동일 카드 스타일
- [x] 종목 발굴 (/discover): 동일 카드 스타일
- [x] 설정 (/settings): 동일 카드 스타일

## 6. 금지 사항

1. ❌ `globals.css`의 `@theme` / `@layer` 구조를 임의 변경
2. ❌ `git reset --hard` main 브랜치에서 실행
3. ❌ 새 테마 패키지 (next-themes 등) 임의 도입
4. ❌ 10개 이상 파일 동시 수정 (Circuit Breaker 발동)
5. ❌ 승인 없이 색상 계열 자체를 변경 (그린 → 블루 등)

## 7. 승인 이력

| 날짜 | 태그 | 설명 | 스냅샷 |
|---|---|---|---|
| (예정) | `v-approved-YYYYMMDD-*` | 첫 번째 공식 승인 | `snapshots/` |

---

> ⚠️ **에이전트 주의**: 이 파일의 사양과 현재 코드가 불일치할 경우, 
> 이 파일의 사양이 **진실(ground truth)**이며, 코드를 이 사양에 맞춰 수정해야 합니다.
