import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  AFFECTED,
  CATEGORIES,
  CONVERSATION_STATUSES,
  DRAFT_MODES,
  DRAFT_STATES,
  HANDOFF_REASONS,
  MESSAGE_AUTHORS,
  PRIORITIES,
  SUPPORT_LEVELS,
  TICKET_STATUSES,
  TICKET_TYPES,
  USER_ROLES,
  type AgentDecision,
  type MessageAttachment,
  type TicketDraft,
} from "@nexo/shared";

const tz = { withTimezone: true } as const;

/* ---------- enums ---------- */

export const userRoleEnum = pgEnum("user_role", USER_ROLES);
export const supportLevelEnum = pgEnum("support_level", SUPPORT_LEVELS);
export const ticketTypeEnum = pgEnum("ticket_type", TICKET_TYPES);
export const categoryEnum = pgEnum("ticket_category", CATEGORIES);
export const priorityEnum = pgEnum("ticket_priority", PRIORITIES);
export const affectedEnum = pgEnum("ticket_affected", AFFECTED);
export const ticketStatusEnum = pgEnum("ticket_status", TICKET_STATUSES);
export const conversationStatusEnum = pgEnum("conversation_status", CONVERSATION_STATUSES);
export const handoffReasonEnum = pgEnum("handoff_reason", HANDOFF_REASONS);
export const messageAuthorEnum = pgEnum("message_author", MESSAGE_AUTHORS);
export const draftStateEnum = pgEnum("draft_state", DRAFT_STATES);
export const draftModeEnum = pgEnum("draft_mode", DRAFT_MODES);

export const TICKET_EVENT_KINDS = [
  "created",
  "comment",
  "status_change",
  "reopened",
  "transferred",
] as const;
export const ticketEventKindEnum = pgEnum("ticket_event_kind", TICKET_EVENT_KINDS);

/* ---------- sequences (números de chamado e rascunho) ---------- */

export const incNumberSeq = pgSequence("inc_number_seq", { startWith: 20520 });
export const reqNumberSeq = pgSequence("req_number_seq", { startWith: 10460 });
export const draftNumberSeq = pgSequence("draft_number_seq", { startWith: 381 });

/* ---------- usuários e sessões ---------- */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull(),
  department: text("department").notNull(),
  device: text("device"),
  supportLevel: supportLevelEnum("support_level"),
  createdAt: timestamp("created_at", tz).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    /** Hash SHA-256 do token; o token em si nunca é salvo. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", tz).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ---------- central de ajuda ---------- */

export const kbArticles = pgTable("kb_articles", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  updatedAt: timestamp("updated_at", tz).notNull().defaultNow(),
});

/* ---------- chamados ---------- */

export const tickets = pgTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    type: ticketTypeEnum("type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: categoryEnum("category").notNull(),
    priority: priorityEnum("priority").notNull(),
    affected: affectedEnum("affected").notNull(),
    status: ticketStatusEnum("status").notNull().default("open"),
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
    /** Última atividade: base do cálculo de prazo (Anexo A). */
    updatedAt: timestamp("updated_at", tz).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", tz),
    /** Rascunho que originou o chamado; garante criação idempotente em retries. */
    sourceDraftId: text("source_draft_id").unique(),
  },
  (t) => [
    index("tickets_requester_idx").on(t.requesterId),
    index("tickets_status_idx").on(t.status),
  ],
);

export const ticketEvents = pgTable(
  "ticket_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    kind: ticketEventKindEnum("kind").notNull(),
    authorId: text("author_id").references(() => users.id),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
  },
  (t) => [index("ticket_events_ticket_idx").on(t.ticketId, t.createdAt)],
);

/* ---------- conversas ---------- */

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: text("employee_id")
      .notNull()
      .references(() => users.id),
    status: conversationStatusEnum("status").notNull().default("with_agent"),
    handoffReason: handoffReasonEnum("handoff_reason"),
    /** Resumo do caso gerado na transferência (Anexo A). */
    handoffSummary: text("handoff_summary"),
    handoffAt: timestamp("handoff_at", tz),
    assignedAnalystId: text("assigned_analyst_id").references(() => users.id),
    ticketId: text("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", tz).notNull().defaultNow(),
    closedAt: timestamp("closed_at", tz),
    /** Trava do turno do agent: evita dois turnos simultâneos na mesma conversa. */
    agentLockedUntil: timestamp("agent_locked_until", tz),
  },
  (t) => [
    index("conversations_employee_idx").on(t.employeeId),
    index("conversations_status_idx").on(t.status),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    author: messageAuthorEnum("author").notNull(),
    authorId: text("author_id").references(() => users.id),
    authorName: text("author_name"),
    content: text("content").notNull(),
    attachments: jsonb("attachments")
      .$type<MessageAttachment[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    decision: jsonb("decision").$type<AgentDecision>(),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const ticketDrafts = pgTable(
  "ticket_drafts",
  {
    id: text("id").primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => users.id),
    /** Preenchido quando o rascunho atualiza um chamado existente em vez de criar. */
    targetTicketId: text("target_ticket_id").references(() => tickets.id),
    mode: draftModeEnum("mode").notNull().default("create"),
    /** Texto do complemento ou motivo da reabertura. */
    note: text("note"),
    payload: jsonb("payload").$type<TicketDraft>().notNull(),
    state: draftStateEnum("state").notNull().default("pending"),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", tz),
  },
  (t) => [index("ticket_drafts_conversation_idx").on(t.conversationId)],
);

/* ---------- tipos inferidos ---------- */

export type UserRow = typeof users.$inferSelect;
export type TicketRow = typeof tickets.$inferSelect;
export type TicketEventRow = typeof ticketEvents.$inferSelect;
export type KbArticleRow = typeof kbArticles.$inferSelect;
export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type TicketDraftRow = typeof ticketDrafts.$inferSelect;