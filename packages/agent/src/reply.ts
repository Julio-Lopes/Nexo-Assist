import { z } from "zod";
import { AGENT_ACTIONS, AGENT_INTENTS } from "@nexo/shared";
import type { DeclaredDecision } from "./recorder";

const leakedDecisionSchema = z.object({
  intent: z.enum(AGENT_INTENTS),
  understanding: z.string(),
  action: z.enum(AGENT_ACTIONS),
  confidence: z.number(),
  reason: z.string(),
  rulesApplied: z.array(z.string()).default([]),
});

/**
 * Modelos leves às vezes escrevem a decisão como JSON no texto em vez de chamar a ferramenta.
 * Separa esse bloco do texto e o devolve como decisão.
 */
export function extractLeakedDecision(raw: string): { text: string; decision: DeclaredDecision | null } {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return { text: raw, decision: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { text: raw, decision: null };
  }

  const result = leakedDecisionSchema.safeParse(parsed);
  if (!result.success) return { text: raw, decision: null };

  const before = raw.slice(0, start).replace(/```(?:json)?\s*$/i, "");
  const after = raw.slice(end + 1).replace(/^\s*```/, "");

  return {
    text: `${before} ${after}`.trim(),
    decision: { ...result.data, confidence: Math.min(1, Math.max(0, result.data.confidence)) },
  };
}

/** Remove frases repetidas, "OK" solto e comentários de bastidor sobre os cards. */
export function cleanReply(text: string): string {
  const withoutAsides = text
    .replace(/\s*\[[^\]]*\]/g, "")
    .replace(/\s*\([^)]*\bcard\b[^)]*\)/gi, "");
  const sentences = withoutAsides.split(/(?<=[.!?])\s+/);

  const seen = new Set<string>();
  const kept: string[] = [];
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    const key = trimmed.toLowerCase();
    if (!key || seen.has(key) || /^ok[.!]?$/.test(key)) continue;
    seen.add(key);
    kept.push(trimmed);
  }

  return kept.join(" ").trim();
}

/**
 * Repassa o texto em streaming, mas segura tudo a partir de "{" ou "`":
 * se for um JSON de decisão vazado, ele nunca chega à tela.
 */
export class ReplyStream {
  private emitted = "";
  private held = "";

  constructor(private readonly onText?: (delta: string) => void) {}

  push(delta: string): void {
    if (this.held) {
      this.held += delta;
      return;
    }

    const index = delta.search(/[{`]/);
    if (index === -1) {
      this.emit(delta);
      return;
    }

    this.emit(delta.slice(0, index));
    this.held = delta.slice(index);
  }

  /** Libera o trecho retido quando ele não era uma decisão vazada. */
  flushHeld(): void {
    const held = this.held;
    this.held = "";
    this.emit(held);
  }

  get raw(): string {
    return this.emitted + this.held;
  }

  private emit(delta: string): void {
    if (!delta) return;
    this.emitted += delta;
    this.onText?.(delta);
  }
}