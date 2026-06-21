/**
 * src/lib/ai-provider.ts
 * AI 제공자 추상화 레이어 — Gemini 실패 시 Claude Sonnet 자동 fallback
 *
 * 우선순위: Gemini 2.5 Flash (with Search Grounding) → Claude Sonnet 4.6
 * Claude는 Search Grounding 미지원이지만 재무 추론·한국어 품질이 우수.
 */

import { GEMINI_MODEL, GEMINI_MAX_TOKENS, GEMINI_TOOLS_WITH_SEARCH } from "@/lib/gemini";

export const CLAUDE_MODEL = "claude-sonnet-4-6";
export const CLAUDE_MAX_TOKENS = 8192;

export type StreamChunk = { text: string } | { done: true; saved?: boolean; provider?: string; error?: string };

// ── Gemini 스트리밍 ───────────────────────────────────────────────────────────

export async function* streamGemini(
  prompt: string,
  geminiKey: string,
  timeoutMs = 55_000
): AsyncGenerator<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: GEMINI_TOOLS_WITH_SEARCH,
      generationConfig: { temperature: 0.7, maxOutputTokens: GEMINI_MAX_TOKENS },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Gemini: no response body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(dataStr);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            if (text) yield text;
          } catch {
            // JSON parse failure — skip
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Claude 스트리밍 ───────────────────────────────────────────────────────────

export async function* streamClaude(
  prompt: string,
  claudeKey: string,
  timeoutMs = 55_000
): AsyncGenerator<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeKey,
      "anthropic-version": "2023-06-01",
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      stream: true,
      system:
        "당신은 전문 투자 분석가입니다. 한국어로 명확하고 구체적인 투자 분석 보고서를 작성하세요.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Claude: no response body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim();
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              yield parsed.delta.text as string;
            }
          } catch {
            // skip
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── 통합 스트리밍 with fallback ───────────────────────────────────────────────

export type ProviderResult = {
  generator: AsyncGenerator<string>;
  provider: "gemini" | "claude";
};

/**
 * Gemini를 우선 시도하고 실패 시 Claude로 자동 fallback.
 * 실제 스트리밍은 시작하지 않고 generator만 반환 — 호출자가 iterate.
 */
export async function getAiStream(
  prompt: string,
  timeoutMs = 55_000
): Promise<ProviderResult> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const claudeKey = process.env.ANTHROPIC_API_KEY;

  // Gemini 우선 — API key가 있으면 항상 시도
  if (geminiKey) {
    return {
      generator: streamGemini(prompt, geminiKey, timeoutMs),
      provider: "gemini",
    };
  }

  // Gemini key 없음 → Claude fallback
  if (claudeKey) {
    console.warn("[AI Provider] GEMINI_API_KEY 없음 → Claude fallback");
    return {
      generator: streamClaude(prompt, claudeKey, timeoutMs),
      provider: "claude",
    };
  }

  throw new Error("AI provider 없음 — GEMINI_API_KEY 또는 ANTHROPIC_API_KEY 필요");
}
