import { z } from "zod";

export const TICKET_TYPES = ["INC", "REQ"] as const;
export const ticketTypeSchema = z.enum(TICKET_TYPES);
export type TicketType = z.infer<typeof ticketTypeSchema>;

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  INC: "Incidente",
  REQ: "Requisição",
};

export const CATEGORIES = [
  "access",
  "network_vpn",
  "hardware",
  "software",
  "email",
  "other",
] as const;
export const categorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof categorySchema>;

export const CATEGORY_LABELS: Record<Category, string> = {
  access: "Acesso",
  network_vpn: "Rede e VPN",
  hardware: "Hardware",
  software: "Software",
  email: "E-mail",
  other: "Outros",
};

export const PRIORITIES = ["critical", "high", "medium", "low"] as const;
export const prioritySchema = z.enum(PRIORITIES);
export type Priority = z.infer<typeof prioritySchema>;

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export const TICKET_STATUSES = [
  "open",
  "waiting_analyst",
  "in_progress",
  "waiting_employee",
  "approved",
  "resolved",
  "closed",
] as const;
export const ticketStatusSchema = z.enum(TICKET_STATUSES);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Aberto",
  waiting_analyst: "Aguardando analista",
  in_progress: "Em andamento",
  waiting_employee: "Aguardando você",
  approved: "Aprovado",
  resolved: "Resolvido",
  closed: "Encerrado",
};

const CLOSED_STATUSES: readonly TicketStatus[] = ["resolved", "closed"];

export function isOpenStatus(status: TicketStatus): boolean {
  return !CLOSED_STATUSES.includes(status);
}

export const AFFECTED = ["self", "team", "company"] as const;
export const affectedSchema = z.enum(AFFECTED);
export type Affected = z.infer<typeof affectedSchema>;

export const AFFECTED_LABELS: Record<Affected, string> = {
  self: "Somente você",
  team: "Sua equipe",
  company: "Toda a empresa",
};

export const ticketNumberSchema = z
  .string()
  .regex(/^(INC|REQ)-\d{5}$/, "Número de chamado inválido");

export const ticketSchema = z.object({
  id: ticketNumberSchema,
  type: ticketTypeSchema,
  title: z.string().min(5).max(120),
  description: z.string().min(10).max(2000),
  category: categorySchema,
  priority: prioritySchema,
  affected: affectedSchema,
  status: ticketStatusSchema,
  requesterId: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
});
export type Ticket = z.infer<typeof ticketSchema>;

/** Campos obrigatórios para abrir um chamado (Anexo A: Abertura). */
export const ticketDraftSchema = ticketSchema.pick({
  type: true,
  title: true,
  description: true,
  category: true,
  priority: true,
  affected: true,
});
export type TicketDraft = z.infer<typeof ticketDraftSchema>;

/** Anexo A: chamados resolvidos há até 7 dias podem ser reabertos. */
export const REOPEN_WINDOW_DAYS = 7;

export function canReopen(resolvedAt: Date, now: Date = new Date()): boolean {
  const windowMs = REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - resolvedAt.getTime() <= windowMs;
}