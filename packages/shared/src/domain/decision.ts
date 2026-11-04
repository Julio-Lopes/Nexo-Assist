import { z } from "zod";

export const AGENT_INTENTS = [
  "knowledge_question",
  "ticket_status",
  "ticket_update",
  "ticket_create",
  "handoff_request",
  "out_of_scope",
  "greeting",
  "unclear",
] as const;
export const agentIntentSchema = z.enum(AGENT_INTENTS);
export type AgentIntent = z.infer<typeof agentIntentSchema>;

export const AGENT_INTENT_LABELS: Record<AgentIntent, string> = {
  knowledge_question: "Dúvida",
  ticket_status: "Consulta de chamado",
  ticket_update: "Complemento de chamado",
  ticket_create: "Abertura de chamado",
  handoff_request: "Pedido de analista",
  out_of_scope: "Fora do escopo de TI",
  greeting: "Saudação",
  unclear: "Não ficou claro",
};

export const AGENT_ACTIONS = [
  "answer_from_kb",
  "show_ticket",
  "ask_selection",
  "ask_clarification",
  "propose_draft",
  "create_ticket",
  "update_ticket",
  "reopen_ticket",
  "handoff",
  "redirect_out_of_scope",
  "reply",
] as const;
export const agentActionSchema = z.enum(AGENT_ACTIONS);
export type AgentAction = z.infer<typeof agentActionSchema>;

export const AGENT_ACTION_LABELS: Record<AgentAction, string> = {
  answer_from_kb: "Respondeu pela central de ajuda",
  show_ticket: "Mostrou o chamado",
  ask_selection: "Pediu para escolher um chamado",
  ask_clarification: "Pediu mais informações",
  propose_draft: "Montou um rascunho",
  create_ticket: "Criou o chamado",
  update_ticket: "Atualizou o chamado",
  reopen_ticket: "Reabriu o chamado",
  handoff: "Transferiu para um analista",
  redirect_out_of_scope: "Redirecionou o assunto",
  reply: "Respondeu",
};

/** Cada ação visível acima da resposta ("consultou seus chamados"). */
export const agentStepSchema = z.object({
  tool: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(["success", "error"]),
  durationMs: z.number().int().nonnegative(),
  summary: z.string(),
});
export type AgentStep = z.infer<typeof agentStepSchema>;

/** O detalhe da decisão: o que entendeu, o que fez, com que segurança e por quê. */
export const agentDecisionSchema = z.object({
  intent: agentIntentSchema,
  understanding: z.string().min(1),
  action: agentActionSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  rulesApplied: z.array(z.string()),
  steps: z.array(agentStepSchema),
});
export type AgentDecision = z.infer<typeof agentDecisionSchema>;

/** Abaixo disso o agent não decide sozinho e transfere (Anexo A: Transferência). */
export const CONFIDENCE_HANDOFF_THRESHOLD = 0.6;