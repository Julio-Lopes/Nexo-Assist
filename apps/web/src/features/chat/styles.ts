import type { ConversationStatus, Priority, TicketStatus } from "@nexo/shared";

export const TICKET_STATUS_DOT: Record<TicketStatus, string> = {
  open: "bg-primary",
  waiting_analyst: "bg-warning",
  in_progress: "bg-primary",
  waiting_employee: "bg-warning",
  approved: "bg-success",
  resolved: "bg-ink/25",
  closed: "bg-ink/25",
};

export const TICKET_STATUS_TEXT: Record<TicketStatus, string> = {
  open: "text-ink-3",
  waiting_analyst: "text-warning-text",
  in_progress: "text-primary-text",
  waiting_employee: "text-warning-text",
  approved: "text-success-text",
  resolved: "text-ink-3",
  closed: "text-ink-3",
};

export const PRIORITY_DOT: Record<Priority, string> = {
  critical: "bg-danger",
  high: "bg-warning",
  medium: "bg-ink/40",
  low: "bg-ink/20",
};

export const CONVERSATION_PILL: Record<ConversationStatus, { label: string; box: string; dot: string }> = {
  with_agent: { label: "Assistente online", box: "bg-success-soft text-success-text", dot: "bg-success" },
  waiting_human: { label: "Aguardando analista", box: "bg-warning-soft text-warning-text", dot: "bg-warning" },
  with_human: { label: "Analista atendendo", box: "bg-primary-soft text-primary-text", dot: "bg-primary" },
  closed: { label: "Conversa encerrada", box: "bg-desk text-ink-3", dot: "bg-ink/30" },
};