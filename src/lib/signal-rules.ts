import { db } from "@/db";
import { signalRules } from "@/db/schema";
import { eq } from "drizzle-orm";

export type SignalRuleCondition = {
  metric: string;
  operator: "gt" | "gte" | "lt" | "lte" | "change_pct";
  threshold: number;
  window?: string;
};

export type SignalRuleRow = {
  id: number;
  name: string;
  type: string;
  severity: string;
  condition: SignalRuleCondition;
  isActive: boolean;
};

/** Default rules — seeded when signal_rules table is empty */
export const DEFAULT_SIGNAL_RULES: Omit<SignalRuleRow, "id">[] = [
  {
    name: "주간 급등",
    type: "PRICE_SURGE",
    severity: "LOW",
    condition: { metric: "weekly_return_pct", operator: "gt", threshold: 5 },
    isActive: true,
  },
  {
    name: "주간 급락",
    type: "PRICE_DROP",
    severity: "LOW",
    condition: { metric: "weekly_return_pct", operator: "lt", threshold: -5 },
    isActive: true,
  },
  {
    name: "월간 급등",
    type: "PRICE_SURGE",
    severity: "MEDIUM",
    condition: { metric: "monthly_return_pct", operator: "gt", threshold: 15 },
    isActive: true,
  },
  {
    name: "부채비율 급등",
    type: "DEBT_SPIKE",
    severity: "MEDIUM",
    condition: { metric: "debt_ratio_change_pp", operator: "gt", threshold: 20 },
    isActive: true,
  },
];

export async function seedSignalRulesIfEmpty(): Promise<void> {
  const existing = await db.select({ id: signalRules.id }).from(signalRules).limit(1);
  if (existing.length > 0) return;

  for (const rule of DEFAULT_SIGNAL_RULES) {
    await db.insert(signalRules).values({
      name: rule.name,
      type: rule.type,
      severity: rule.severity,
      conditionJson: JSON.stringify(rule.condition),
      isActive: rule.isActive ? 1 : 0,
    });
  }
}

export async function getActiveSignalRules(): Promise<SignalRuleRow[]> {
  await seedSignalRulesIfEmpty();
  const rows = await db
    .select()
    .from(signalRules)
    .where(eq(signalRules.isActive, 1));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    severity: r.severity ?? "MEDIUM",
    condition: JSON.parse(r.conditionJson) as SignalRuleCondition,
    isActive: Boolean(r.isActive),
  }));
}
