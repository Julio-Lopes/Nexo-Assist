import type { AgentAction, AgentIntent, HandoffReason, MessageAttachment } from "@nexo/shared";
import type { TurnResult } from "../src";

export interface CheckResult {
  label: string;
  pass: boolean;
  detail?: string;
}

export type Check = (result: TurnResult) => CheckResult;

type Kind = MessageAttachment["kind"];
type AttachmentOf<K extends Kind> = Extract<MessageAttachment, { kind: K }>;
type DraftAttachment = AttachmentOf<"draft">;

const toolsOf = (r: TurnResult) => r.decision.steps.map((s) => s.tool);
const kindsOf = (r: TurnResult) => r.attachments.map((a) => a.kind).join(", ") || "nenhum";

export const usedTool =
  (tool: string): Check =>
  (r) => ({ label: `usou ${tool}`, pass: toolsOf(r).includes(tool), detail: `ferramentas: ${toolsOf(r).join(", ") || "nenhuma"}` });

/** Nenhuma consulta ou alteração em sistemas (fora do escopo, saudação). */
export const noSystemCalls: Check = (r) => ({
  label: "não consultou sistemas",
  pass: r.decision.steps.length === 0,
  detail: `ferramentas: ${toolsOf(r).join(", ") || "nenhuma"}`,
});

export const intent =
  (...expected: AgentIntent[]): Check =>
  (r) => ({ label: `intenção ${expected.join(" ou ")}`, pass: expected.includes(r.decision.intent), detail: `obtido: ${r.decision.intent}` });

export const action =
  (...expected: AgentAction[]): Check =>
  (r) => ({ label: `ação ${expected.join(" ou ")}`, pass: expected.includes(r.decision.action), detail: `obtido: ${r.decision.action}` });

export function attachment<K extends Kind>(kind: K, label: string, predicate: (a: AttachmentOf<K>) => boolean = () => true): Check {
  return (r) => ({
    label,
    pass: r.attachments.some((a) => a.kind === kind && predicate(a as AttachmentOf<K>)),
    detail: `cards: ${kindsOf(r)}`,
  });
}

export function noAttachment<K extends Kind>(kind: K, label: string, predicate: (a: AttachmentOf<K>) => boolean = () => true): Check {
  return (r) => ({
    label,
    pass: !r.attachments.some((a) => a.kind === kind && predicate(a as AttachmentOf<K>)),
    detail: `cards: ${kindsOf(r)}`,
  });
}

export const draft = (label: string, predicate: (d: DraftAttachment) => boolean): Check => (r) => {
  const drafts = r.attachments.filter((a): a is DraftAttachment => a.kind === "draft");
  return {
    label,
    pass: drafts.some(predicate),
    detail: drafts.length
      ? drafts.map((d) => `${d.mode} ${d.draft.type} ${d.draft.category} ${d.draft.priority}${d.targetTicketId ? ` ${d.targetTicketId}` : ""}`).join("; ")
      : "nenhum rascunho",
  };
};

export const handoff =
  (...reasons: HandoffReason[]): Check =>
  (r) => ({
    label: `transferiu (${reasons.join(" ou ")})`,
    pass: r.handoff !== null && reasons.includes(r.handoff.reason),
    detail: r.handoff ? `motivo: ${r.handoff.reason}` : "sem transferência",
  });

export const noHandoff: Check = (r) => ({
  label: "não transferiu",
  pass: r.handoff === null,
  detail: r.handoff ? `motivo: ${r.handoff.reason}` : undefined,
});

export const textIncludes =
  (pattern: RegExp, label: string): Check =>
  (r) => ({ label, pass: pattern.test(r.text) });

export const textExcludes =
  (pattern: RegExp, label: string): Check =>
  (r) => ({ label, pass: !pattern.test(r.text) });

/** Passa se qualquer uma das checagens passar. */
export const anyOf =
  (label: string, ...checks: Check[]): Check =>
  (r) => {
    const results = checks.map((check) => check(r));
    return { label, pass: results.some((c) => c.pass), detail: results.map((c) => `${c.label}: ${c.pass ? "sim" : "não"}`).join("; ") };
  };

/** Rodam em todo turno: qualidade da resposta e aderência do modelo ao formato. */
export const GLOBAL_CHECKS: Check[] = [
  textExcludes(/\{\s*"intent"|"rulesApplied"|record_decision/, "resposta sem decisão vazada"),
  textExcludes(/\bOK\.?\s*$|\([^)]*\bcard\b[^)]*\)/i, "resposta sem enchimento nem bastidores"),
  textExcludes(/chamado D-\d+/i, "não chama o rascunho de chamado"),
  (r) => ({
    label: "registrou a decisão pela ferramenta",
    pass: !r.decision.rulesApplied.some((rule) => /inferida|recuperada/i.test(rule)),
    detail: r.decision.rulesApplied.join("; ") || undefined,
  }),
];