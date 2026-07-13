# GSF-Research 기업분석 프레임워크
> 생성: 2026-07-13 | 작성: Claude

## 설계 철학
분석의 존재 이유는 단 세 가지 행동뿐:
① 매수 / ② 보유 / ③ 매도

이 세 가지 결정에 영향을 주지 않는 정보는 수집하지 않는다.
모든 종목 파일은 **"현재 액션 + 트리거 조건"**을 최상단에 명시.

---

## 증거 위계 (Evidence Hierarchy)

| Tier | 소스 | 용도 | 신뢰도 |
|------|------|------|--------|
| T1 | DART 공시 원문 (사업보고서·주요사항) | 사실 확정 | 최고 |
| T1 | 관세청/B/L 원본 데이터 | 물류 실증 | 최고 |
| T1 | WIPO / KIPRIS 상표·특허 원부 | IP 전략 | 최고 |
| T2 | 감사보고서 (비상장 자회사 포함) | 재무 세부 | 높음 |
| T2 | 회사 IR 자료, 주총 의사록 | 경영진 의도 | 높음 |
| T3 | 산업 통계 (FIS, SNE, 협회) | 시장 규모 | 중간 |
| T4 | 증권사 리포트 | 컨센서스 파악 | 낮음 |
| T5 | **언론 기사** | **대중 심리 추적용만 — 사실 확정 금지** | 매우 낮음 |

**운영 규칙:**
- MASTER.md에는 T1~T2만 기록 가능
- T5(언론)는 news_sentiment.md에 격리 — 역발상 지표로만 활용
- 언론이 일제히 비관할 때 T1 데이터가 반대를 가리키면 → 기회

---

## 종목당 분석 파이프라인 (5단계)

1. **THESIS 작성** — 투자 논지를 한 문단으로. 못 쓰면 관심 종목일 뿐.
2. **T1 데이터 구축** — Cursor: DART API, B/L, WIPO 자동화
3. **시나리오 수치화** — Claude: Bull/Base/Bear + 발동 트리거
4. **SIGNALS 가동** — 주 1회 신호판 갱신
5. **액션 실행·기록** — 매수/매도 시 "당시 논리" 기록 (복기용)

---

## 역할 분담

| 담당 | 역할 |
|------|------|
| Claude | THESIS·시나리오·신호 해석, 파일 갱신, Cursor 브리프 작성 |
| Cursor | DART API 파이프라인, B/L 스크래핑, 히스토리 데이터 수집 |
| Joseph | 최종 매매 결정, 직접 관찰 정보 입력, 주 1회 신호판 리뷰 |

---

## 디렉토리 구조

```
research/
  _FRAMEWORK.md
  _WATCHLIST.md
  {종목명-코드}/
    THESIS.md       ← 가장 중요
    MASTER.md
    SIGNALS.md
    valuation.md
    RAW/
      financials.md
      shareholders.md
      bl_records.md
      ip_records.md
      news_sentiment.md
```

**확장 규칙:** 새 종목 = 폴더 복제 + THESIS.md부터 작성.
