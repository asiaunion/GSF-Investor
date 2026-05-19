/** Discover checklist scoring thresholds by investment style */

export type ScreeningPresetId = "balanced" | "value" | "growth" | "dividend";

export type ScreeningThresholds = {
  pbrMax: number;
  perMax: number;
  debtRatioMax: number;
  minDividendYears: number;
};

export const SCREENING_PRESETS: Record<
  ScreeningPresetId,
  { label: string; description: string; thresholds: ScreeningThresholds }
> = {
  balanced: {
    label: "균형",
    description: "가치·성장·배당을 균형 있게",
    thresholds: { pbrMax: 1.5, perMax: 15, debtRatioMax: 150, minDividendYears: 2 },
  },
  value: {
    label: "가치",
    description: "저 PBR·저 PER 중심",
    thresholds: { pbrMax: 1.0, perMax: 12, debtRatioMax: 120, minDividendYears: 1 },
  },
  growth: {
    label: "성장",
    description: "PER 여유·부채 관리",
    thresholds: { pbrMax: 3.0, perMax: 25, debtRatioMax: 100, minDividendYears: 0 },
  },
  dividend: {
    label: "배당",
    description: "배당 연속성·재무 안정",
    thresholds: { pbrMax: 2.0, perMax: 18, debtRatioMax: 130, minDividendYears: 3 },
  },
};

export function scorePbr(pbr: number | null, preset: ScreeningPresetId): number {
  if (pbr == null || pbr <= 0) return 0;
  const max = SCREENING_PRESETS[preset].thresholds.pbrMax;
  if (pbr <= max) return 100;
  if (pbr <= max * 1.5) return 60;
  return 30;
}

export function scorePer(per: number | null, preset: ScreeningPresetId): number {
  if (per == null || per <= 0) return 0;
  const max = SCREENING_PRESETS[preset].thresholds.perMax;
  if (per <= max) return 100;
  if (per <= max * 1.3) return 55;
  return 25;
}

export function scoreDebtRatio(ratio: number | null, preset: ScreeningPresetId): number {
  if (ratio == null) return 50;
  const max = SCREENING_PRESETS[preset].thresholds.debtRatioMax;
  if (ratio <= max) return 100;
  if (ratio <= max * 1.2) return 50;
  return 20;
}

export function scoreDividendYears(years: number, preset: ScreeningPresetId): number {
  const min = SCREENING_PRESETS[preset].thresholds.minDividendYears;
  if (min === 0) return years > 0 ? 80 : 50;
  if (years >= min) return 100;
  if (years >= min - 1) return 60;
  return years > 0 ? 40 : 0;
}
