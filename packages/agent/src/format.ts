import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
} from "@nexo/shared";
import type { TicketView } from "@nexo/tickets";

const TZ = "America/Sao_Paulo";

const shortFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});

const fullFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ, weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
});

/** "05/11 às 13:43" */
export const formatDateTime = (date: Date): string => shortFmt.format(date).replace(", ", " às ");

export const formatFullDateTime = (date: Date): string => fullFmt.format(date);

/** Datas relativas calculadas em código: o modelo não precisa fazer conta de datas. */
export function timeAgo(from: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - from.getTime()) / 60_000));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}

/** Versão compacta e legível do chamado para o modelo. */
export function describeTicket(ticket: TicketView, now: Date) {
  return {
    id: ticket.id,
    type: TICKET_TYPE_LABELS[ticket.type],
    title: ticket.title,
    category: CATEGORY_LABELS[ticket.category],
    priority: PRIORITY_LABELS[ticket.priority],
    status: TICKET_STATUS_LABELS[ticket.status],
    lastUpdate: timeAgo(new Date(ticket.updatedAt), now),
    overdue: ticket.overdue,
    nextResponseDue: ticket.dueAt ? formatDateTime(new Date(ticket.dueAt)) : null,
    sla: ticket.slaLabel,
    reopenable: ticket.reopenable,
  };
}