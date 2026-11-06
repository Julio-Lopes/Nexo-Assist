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

/** Parece JSON: tem uma chave entre aspas seguida de dois-pontos. "{nome}" não conta. */
const looksLikeJson = (block: string) => /"\s*:/.test(block);

/**
 * Separa do texto os blocos com cara de JSON, inclusive malformados ou sem fechar.
 * Respeita chaves dentro de strings para achar o fim certo de cada bloco.
 */
export function splitJsonBlocks(raw: string): { text: string; blocks: string[] } {
  let text = "";
  const blocks: string[] = [];
  let i = 0;

  while (i < raw.length) {
    if (raw[i] !== "{") {
      text += raw[i];
      i++;
      continue;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = raw.length - 1;

    for (let j = i; j < raw.length; j++) {
      const ch = raw[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) {
        end = j;
        break;
      }
    }

    const block = raw.slice(i, end + 1);
    if (looksLikeJson(block)) {
      blocks.push(block);
      i = end + 1;
    } else {
      text += raw[i];
      i++;
    }
  }

  return { text: text.replace(/```(?:json)?/gi, "").replace(/\s{2,}/g, " ").trim(), blocks };
}

/**
 * Modelos leves às vezes escrevem no texto o que deveria ser chamada de ferramenta.
 * Todo JSON sai da resposta; se algum bloco for a decisão do turno, ele é devolvido.
 */
export function extractLeakedDecision(raw: string): { text: string; decision: DeclaredDecision | null } {
  const { text, blocks } = splitJsonBlocks(raw);

  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch {
      continue;
    }
    const result = leakedDecisionSchema.safeParse(parsed);
    if (result.success) {
      return { text, decision: { ...result.data, confidence: Math.min(1, Math.max(0, result.data.confidence)) } };
    }
  }

  return { text, decision: null };
}

/** Remove frases repetidas, "OK" solto, colchetes e comentários de bastidor sobre os cards. */
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
 * Repassa o texto em streaming, mas segura tudo a partir de "{" ou "`".
 * No fim, só libera o que sobrou depois de remover os blocos JSON.
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

  /** Emite a parte final já limpa, quando ela continua o que foi mostrado. */
  finish(finalText: string): void {
    this.held = "";
    const shown = this.emitted.trimEnd();
    if (finalText.startsWith(shown)) {
      const remainder = finalText.slice(shown.length);
      this.emit(this.emitted.length > shown.length ? remainder.trimStart() : remainder);
    }
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