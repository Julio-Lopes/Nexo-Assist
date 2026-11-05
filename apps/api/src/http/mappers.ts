import type { ConversationRow, MessageRow, UserRow } from "@nexo/db";
import type { Conversation, Message, User } from "@nexo/shared";

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    department: row.department,
    device: row.device,
    supportLevel: row.supportLevel,
  };
}

export function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    employeeId: row.employeeId,
    status: row.status,
    handoffReason: row.handoffReason,
    handoffSummary: row.handoffSummary,
    handoffAt: row.handoffAt?.toISOString() ?? null,
    assignedAnalystId: row.assignedAnalystId,
    ticketId: row.ticketId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    author: row.author,
    authorName: row.authorName,
    content: row.content,
    attachments: row.attachments,
    decision: row.decision ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}