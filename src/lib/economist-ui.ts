/** Economist editorial UI tokens — design-baseline §2–3 */

export const economistCard =
  "bg-bg-surface border-t-4 border-t-brand-green border border-border-default rounded-sm shadow-sm";

export const economistStatCard =
  "bg-bg-surface border-t-4 border-t-brand-green border border-border-default rounded-sm shadow-sm p-4";

export const economistSection = "border-t-4 border-brand-green pt-6";

/** 설정 탭과 동일한 페이지 본문 간격 */
export const pageContentSpace = "space-y-6";

/** 설정 탭 기준 페이지 레이아웃 */
export const pageShell = "min-h-screen bg-bg-base";
export const pageContainer = "max-w-5xl mx-auto px-4 py-8 space-y-6";
export const pageContainerWide = "max-w-7xl mx-auto px-4 py-8 space-y-6";
export const pageTitle = "text-2xl font-bold text-text-primary";
export const pageSubtitle = "text-sm text-text-muted mt-1";

/** 2-tone palette: Forest Green (primary) + Slate brand-blue (secondary) */
export const btnPrimary =
  "bg-brand-green border border-brand-green text-white hover:bg-brand-green/85";

export const btnPrimaryOutline =
  "bg-brand-green/10 border border-brand-green/25 text-brand-green hover:bg-brand-green/15";

export const btnNeutral =
  "bg-bg-elevated border border-border-strong text-text-secondary hover:border-brand-green/25 hover:text-brand-green";

export const btnDanger =
  "border border-loss-border text-loss-400 hover:bg-loss-bg";

export const inputFocus =
  "focus:outline-none focus:ring-1 focus:ring-brand-green/40 focus:border-brand-green";

export const inputClass = `w-full bg-bg-elevated border border-border-strong text-text-primary rounded-sm px-3 py-2 text-sm ${inputFocus}`;

export const tabActive =
  "font-bold text-brand-green bg-brand-green/10 border border-brand-green/25";

export const tabInactive =
  "font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated";

export const marketBadge: Record<string, string> = {
  KR: "bg-brand-blue/10 text-brand-blue border border-brand-blue/25",
  US: "bg-brand-green/10 text-brand-green border border-brand-green/25",
};

export function categoryBadge(category: string): string {
  return category === "Core"
    ? "bg-brand-green/12 text-brand-green border border-brand-green/25"
    : "bg-brand-blue/10 text-brand-blue border border-brand-blue/25";
}

/** Score grades — green/slate spectrum; D only uses loss */
export const gradeBadge: Record<string, string> = {
  A: "text-brand-green bg-brand-green/12 border border-brand-green/30",
  B: "text-brand-green/90 bg-brand-green/8 border border-brand-green/20",
  C: "text-brand-blue bg-brand-blue/10 border border-brand-blue/25",
  D: "text-loss-400 bg-loss-bg border border-loss-border",
};

export const tradeActionBadge: Record<string, string> = {
  BUY: "text-profit-400 bg-profit-bg border border-profit-border",
  SELL: "text-loss-400 bg-loss-bg border border-loss-border",
  INIT: "text-brand-green bg-brand-green/10 border border-brand-green/25",
};

/** Emotion tags — no rainbow; green / slate / warn / loss */
export const emotionBadge: Record<string, string> = {
  확신: "text-brand-green bg-brand-green/10 border border-brand-green/25",
  계획적: "text-brand-blue bg-brand-blue/10 border border-brand-blue/25",
  불안: "text-warn-400 bg-warn-bg border border-warn-border",
  충동: "text-loss-400 bg-loss-bg border border-loss-border",
};

export const severityConfig = {
  HIGH: {
    dot: "bg-loss-500",
    badge: "bg-loss-bg text-loss-400 border border-loss-border",
    text: "text-loss-400",
    bg: "bg-loss-bg/50",
  },
  MEDIUM: {
    dot: "bg-warn-400",
    badge: "bg-warn-bg text-warn-400 border border-warn-border",
    text: "text-warn-400",
    bg: "bg-warn-bg/50",
  },
  LOW: {
    dot: "bg-brand-blue",
    badge: "bg-brand-blue/10 text-brand-blue border border-brand-blue/25",
    text: "text-text-secondary",
    bg: "",
  },
} as const;

export const linkMuted = "text-brand-green hover:text-brand-green/80 transition-colors";

export const textareaClass = `${inputClass} resize-none`;

export const selectClass = inputClass;

export const btnPrimarySm =
  "px-4 py-2 rounded-sm text-xs font-medium text-white bg-brand-green border border-brand-green hover:bg-brand-green/85 disabled:bg-bg-elevated disabled:text-text-muted disabled:border-border-default transition-colors";

export const economistPanelBody = "p-5";

/** P&amp;L positive / negative text (no neon emerald/red) */
export function pnlTextClass(value: number | null | undefined): string {
  if (value == null || value === 0) return "text-text-muted";
  return value > 0 ? "text-profit-400" : "text-loss-400";
}

/** 설정 탭 인라인 폼·리스트 행 액션 */
export const panelInlineForm =
  "px-6 py-5 bg-bg-base/60 border-b border-border-default";

export const listRowChevron =
  "text-text-secondary text-sm transition-transform duration-200 shrink-0";
