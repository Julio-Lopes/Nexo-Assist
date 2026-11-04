import type { TicketEventRow, TicketRow } from "@nexo/db";
import {
  SLA_RULES,
  canReopen,
  computeDueAt,
  isOpenStatus,
  isOverdue,
  type Ticket,
} from "@nexo/shared";
import type { TicketEventView, TicketView } from "./types";

export function toTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    affected: row.affected,
    status: row.status,
    requesterId: row.requesterId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}

export function toTicketView(row: TicketRow, now: Date = new Date()): TicketView {
  const open = isOpenStatus(row.status);

  return {
    ...toTicket(row),
    dueAt: open ? computeDueAt(row.priority, row.updatedAt).toISOString() : null,
    overdue: isOverdue(
      { priority: row.priority, status: row.status, lastActivityAt: row.updatedAt },
      now,
    ),
    slaLabel: SLA_RULES[row.priority].label,
    reopenable: row.status === "resolved" && row.resolvedAt !== null && canReopen(row.resolvedAt, now),
  };
}

export function toEventView(row: TicketEventRow): TicketEventView {
  return {
    id: row.id,
    kind: row.kind,
    authorName: row.authorName,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}