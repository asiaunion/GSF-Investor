/** AI 보고서 상단 면책·데이터 기준 고지 */
export function AiReportDisclaimer({
  generatedAt,
  dataAsOf,
}: {
  generatedAt: string;
  dataAsOf?: string | null;
}) {
  const genDate = generatedAt.slice(0, 10);
  return (
    <div
      className="mb-6 rounded-sm border border-warn-border bg-warn-bg/40 px-4 py-3 text-xs text-text-secondary leading-relaxed"
      role="note"
    >
      <p className="font-semibold text-warn-400 mb-1">투자 참고용 · AI 생성 콘텐츠</p>
      <p>
        본 문서는 투자 권유·매매 추천이 아닙니다. Gemini가 생성한 분석이며 서술·전망은 검증되지 않았습니다.
        재무 수치는 DB 기준 팩트체크(±5%)를 적용합니다.
      </p>
      <p className="mt-1 text-text-muted">
        생성일: {genDate}
        {dataAsOf ? ` · 재무 데이터 기준: ${dataAsOf}` : ""}
      </p>
    </div>
  );
}
