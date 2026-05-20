export type BigCategory = "유가증권 및 현금" | "부동산" | "대출 및 부채";

const DEBT_KEYWORDS = [
  "주택담보",
  "주식담보",
  "임대보증금",
  "카드",
  "학자금",
  "대출",
];

export function inferBigCategory(category: string): BigCategory {
  const c = category.trim();
  if (DEBT_KEYWORDS.some((k) => c.includes(k))) return "대출 및 부채";
  if (c.includes("부동산")) return "부동산";
  if (c === "예수금" || c.includes("예수금")) return "유가증권 및 현금";
  return "유가증권 및 현금";
}

export function isLiabilityCategory(category: string): boolean {
  const c = category.trim();
  if (c === "예수금") return false;
  if (c.includes("부동산시세")) return false;
  return (
    DEBT_KEYWORDS.some((k) => c.includes(k)) ||
    (c.includes("보증금") && !c.includes("부동산시세"))
  );
}

export function isStockCategory(category: string): boolean {
  return category.trim() === "주식";
}

export const WEALTH_CATEGORY_OPTIONS = [
  { value: "예수금", label: "예수금 (증권사별)" },
  { value: "부동산시세", label: "부동산 시세" },
  { value: "부동산 보증금", label: "부동산 보증금" },
  { value: "주택담보대출", label: "주택담보대출" },
  { value: "주식담보대출", label: "주식담보대출" },
  { value: "카드(장기)대출", label: "카드(장기)대출" },
  { value: "학자금대출", label: "학자금대출" },
  { value: "기타대출", label: "기타대출" },
  { value: "기타", label: "기타 자산" },
] as const;
