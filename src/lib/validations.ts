import { NextResponse } from "next/server";
import { z } from "zod";

export const journalCreateSchema = z.object({
  stockId: z.coerce.number().int().positive(),
  tradedAt: z.string().min(1),
  action: z.enum(["BUY", "SELL", "INIT"]),
  quantity: z.coerce.number().positive(),
  price: z.coerce.number().nonnegative(),
  currency: z.string().default("KRW"),
  thesis: z.string().min(1, "투자 테제는 필수입니다"),
  category: z.enum(["Core", "Satellite"]).default("Core"),
  emotionTag: z
    .union([z.enum(["확신", "계획적", "불안", "충동"]), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  confidenceScore: z.coerce.number().int().min(0).max(5).nullable().optional(),
  loanInterest: z.coerce.number().nonnegative().nullable().optional(),
  retrospective: z.string().nullable().optional(),
});

export const journalUpdateSchema = journalCreateSchema
  .partial()
  .extend({ stockId: z.coerce.number().int().positive().optional() });

export const stockNoteSchema = z.object({
  contentMd: z.string().min(1),
});

export const discoverAddSchema = z.object({
  ticker: z.string().min(1),
  name: z.string().min(1),
  market: z.enum(["KR", "US"]),
  category: z.enum(["Core", "Satellite"]).default("Core"),
  yahooTicker: z.string().optional(),
  dartCorpCode: z.string().optional(),
  secCik: z.string().optional(),
  broker: z.string().optional(),
  thesis: z.string().optional(),
});

export const settingsStockPatchSchema = z
  .object({
    name: z.string().optional(),
    category: z.enum(["Core", "Satellite"]).optional(),
    sector: z.string().nullable().optional(),
    broker: z.string().nullable().optional(),
    thesis: z.string().nullable().optional(),
    isActive: z.coerce.number().int().min(0).max(1).optional(),
  })
  .strict();

export function validationErrorResponse(error: z.ZodError) {
  const first = error.issues[0];
  return NextResponse.json(
    { error: first?.message ?? "입력값이 올바르지 않습니다", issues: error.issues },
    { status: 400 }
  );
}
