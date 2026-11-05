import { z } from "zod";
import { agentDecisionSchema } from "./decision";
import { ticketDraftSchema, ticketNumberSchema } from "./ticket";

export const MESSAGE_LIMIT_PER_SESSION = 30;

export const CONVERSATION_STATUSES = [
  "with_agent",
  "waiting_human",
  "with_human",
  "closed",
] as const;
export const conversationStatusSchema = z.enum(CONVERSATION_STATUSES);
export type ConversationStatus = z.infer<typeof conversationStatusSchema>;

export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> = {
  with_agent: "Agent atendendo",
  waiting_human: "Aguardando atendente",
  with_human: "Analista atendendo",
  closed: "Encerrada",
};

export const HANDOFF_REASONS = [
  "employee_request",
  "critical",
  "overdue",
  "low_confidence",
] as const;
export const handoffReasonSchema = z.enum(HANDOFF_REASONS);
export type HandoffReason = z.infer<typeof handoffReasonSchema>;

export const HANDOFF_REASON_LABELS: Record<HandoffReason, string> = {
  employee_request: "Funcionário pediu",
  critical: "Caso crítico",
  overdue: "Chamado vencido",
  low_confidence: "Agent pediu ajuda",
};

export const MESSAGE_AUTHORS = ["employee", "agent", "analyst", "system"] as const;
export const messageAuthorSchema = z.enum(MESSAGE_AUTHORS);
export type MessageAuthor = z.infer<typeof messageAuthorSchema>;

export const quickOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});
export type QuickOption = z.infer<typeof quickOptionSchema>;

export const DRAFT_STATES = ["pending", "confirmed", "cancelled"] as const;

/** Cards que aparecem dentro das mensagens do agent (Telas 2 e 3). */
export const messageAttachmentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ticket"), ticketId: ticketNumberSchema }),
  z.object({
    kind: z.literal("ticket_selector"),
    ticketIds: z.array(ticketNumberSchema).min(1),
  }),
  z.object({
    kind: z.literal("draft"),
    draftId: z.string().min(1),
    draft: ticketDraftSchema,
    dueAt: z.iso.datetime(),
    state: z.enum(DRAFT_STATES),
  }),
  z.object({
    kind: z.literal("options"),
    question: z.string().nullable(),
    options: z.array(quickOptionSchema).min(1),
  }),
]);
export type MessageAttachment = z.infer<typeof messageAttachmentSchema>;

export const messageSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  author: messageAuthorSchema,
  authorName: z.string().nullable(),
  content: z.string(),
  attachments: z.array(messageAttachmentSchema),
  /** Preenchido só nas mensagens do agent. */
  decision: agentDecisionSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type Message = z.infer<typeof messageSchema>;

export const conversationSchema = z.object({
  id: z.string().min(1),
  employeeId: z.string().min(1),
  status: conversationStatusSchema,
  handoffReason: handoffReasonSchema.nullable(),
  handoffSummary: z.string().nullable(),
  handoffAt: z.iso.datetime().nullable(),
  assignedAnalystId: z.string().nullable(),
  ticketId: ticketNumberSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  closedAt: z.iso.datetime().nullable(),
});
export type Conversation = z.infer<typeof conversationSchema>;