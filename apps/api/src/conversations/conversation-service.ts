import {
  and,
  asc,
  conversations,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lte,
  messages,
  ne,
  or,
  sql,
  users,
  type ConversationRow,
  type Database,
  type MessageRow,
  type UserRow,
} from "@nexo/db";
import type { AgentDecision, HandoffReason, MessageAttachment, MessageAuthor, User } from "@nexo/shared";
import {
  ConversationError,
  ConversationNotFoundError,
  nextStatus,
  type ConversationAction,
} from "./state";

export const CONSOLE_FILTERS = ["for_you", "with_agent", "mine", "all"] as const;
export type ConsoleFilter = (typeof CONSOLE_FILTERS)[number];

export interface AppendMessageInput {
  conversationId: string;
  author: MessageAuthor;
  authorId: string | null;
  authorName: string | null;
  content: string;
  attachments?: MessageAttachment[];
  decision?: AgentDecision | null;
}

export interface HandoffInput {
  reason: HandoffReason;
  summary: string;
  ticketId?: string | null;
}

export interface ConsoleItem {
  conversation: ConversationRow;
  employee: Pick<UserRow, "id" | "name" | "department">;
  lastMessage: MessageRow | null;
}

export interface ConsoleList {
  items: ConsoleItem[];
  counts: Record<ConsoleFilter, number>;
}

type ConversationChanges = Partial<typeof conversations.$inferInsert>;

interface TransitionOptions {
  changes: ConversationChanges;
  message: string;
  guard?: (current: ConversationRow) => void;
}

function assertAssignedTo(analyst: User) {
  return (current: ConversationRow) => {
    if (current.status === "with_human" && current.assignedAnalystId !== analyst.id) {
      throw new ConversationError("Outro analista está atendendo esta conversa.", "conflict");
    }
  };
}

export class ConversationService {
  constructor(private readonly db: Database) {}

  /** A conversa continua a mesma até ser encerrada (história 6: voltar outro dia). */
  async getOrCreateActive(employeeId: string): Promise<ConversationRow> {
    const [existing] = await this.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.employeeId, employeeId), ne(conversations.status, "closed")))
      .orderBy(desc(conversations.updatedAt))
      .limit(1);

    if (existing) return existing;

    const [created] = await this.db.insert(conversations).values({ employeeId }).returning();
    if (!created) throw new Error("Falha ao criar a conversa.");
    return created;
  }

  async getForEmployee(employeeId: string, conversationId: string): Promise<ConversationRow> {
    const [row] = await this.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.employeeId, employeeId)))
      .limit(1);

    if (!row) throw new ConversationNotFoundError();
    return row;
  }

  async getWithEmployee(conversationId: string): Promise<{ conversation: ConversationRow; employee: UserRow }> {
    const [row] = await this.db
      .select({ conversation: conversations, employee: users })
      .from(conversations)
      .innerJoin(users, eq(users.id, conversations.employeeId))
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!row) throw new ConversationNotFoundError();
    return row;
  }

  /** Com "after", devolve só o que chegou depois (polling). O cliente deduplica por id. */
  async listMessages(conversationId: string, after?: Date): Promise<MessageRow[]> {
    return this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          after ? gt(messages.createdAt, after) : undefined,
        ),
      )
      .orderBy(asc(messages.createdAt));
  }

  async countEmployeeMessagesSince(conversationId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.author, "employee"),
          gte(messages.createdAt, since),
        ),
      );
    return row?.value ?? 0;
  }

  async appendMessage(input: AppendMessageInput): Promise<MessageRow> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(messages)
        .values({
          conversationId: input.conversationId,
          author: input.author,
          authorId: input.authorId,
          authorName: input.authorName,
          content: input.content,
          attachments: input.attachments ?? [],
          decision: input.decision ?? null,
        })
        .returning();

      await tx
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, input.conversationId));

      if (!row) throw new Error("Falha ao salvar a mensagem.");
      return row;
    });
  }

  handoff(conversationId: string, input: HandoffInput): Promise<ConversationRow> {
    return this.transition(conversationId, "handoff", {
      changes: {
        handoffReason: input.reason,
        handoffSummary: input.summary,
        handoffAt: new Date(),
        ...(input.ticketId ? { ticketId: input.ticketId } : {}),
      },
      message: "Transferida para um analista",
    });
  }

  take(conversationId: string, analyst: User): Promise<ConversationRow> {
    return this.transition(conversationId, "take", {
      changes: { assignedAnalystId: analyst.id },
      message: `${analyst.name} assumiu · agent pausado`,
    });
  }

  release(conversationId: string, analyst: User): Promise<ConversationRow> {
    return this.transition(conversationId, "release", {
      changes: { assignedAnalystId: null },
      message: `${analyst.name} devolveu a conversa ao agent`,
      guard: assertAssignedTo(analyst),
    });
  }

  close(conversationId: string, analyst: User): Promise<ConversationRow> {
    return this.transition(conversationId, "close", {
      changes: { closedAt: new Date() },
      message: `Atendimento encerrado por ${analyst.name}`,
      guard: assertAssignedTo(analyst),
    });
  }

  async listForConsole(filter: ConsoleFilter, analystId: string): Promise<ConsoleList> {
    const where =
      filter === "for_you"
        ? eq(conversations.status, "waiting_human")
        : filter === "with_agent"
          ? eq(conversations.status, "with_agent")
          : filter === "mine"
            ? and(eq(conversations.status, "with_human"), eq(conversations.assignedAnalystId, analystId))
            : undefined;

    const rows = await this.db
      .select({
        conversation: conversations,
        employee: { id: users.id, name: users.name, department: users.department },
      })
      .from(conversations)
      .innerJoin(users, eq(users.id, conversations.employeeId))
      .where(where)
      .orderBy(desc(conversations.updatedAt))
      .limit(50);

    const ids = rows.map((r) => r.conversation.id);
    const latest = ids.length
      ? await this.db
          .selectDistinctOn([messages.conversationId])
          .from(messages)
          .where(inArray(messages.conversationId, ids))
          .orderBy(messages.conversationId, desc(messages.createdAt))
      : [];
    const lastById = new Map(latest.map((m) => [m.conversationId, m]));

    return {
      items: rows.map((r) => ({ ...r, lastMessage: lastById.get(r.conversation.id) ?? null })),
      counts: await this.consoleCounts(analystId),
    };
  }

  private async consoleCounts(analystId: string): Promise<Record<ConsoleFilter, number>> {
    const byStatus = await this.db
      .select({ status: conversations.status, value: count() })
      .from(conversations)
      .groupBy(conversations.status);

    const [mine] = await this.db
      .select({ value: count() })
      .from(conversations)
      .where(and(eq(conversations.status, "with_human"), eq(conversations.assignedAnalystId, analystId)));

    const get = (status: string) => byStatus.find((s) => s.status === status)?.value ?? 0;

    return {
      for_you: get("waiting_human"),
      with_agent: get("with_agent"),
      mine: mine?.value ?? 0,
      all: get("waiting_human") + get("with_agent") + get("with_human"),
    };
  }

  /** Trava atômica: só um turno do agent por conversa, inclusive entre instâncias serverless. */
  async tryLockAgent(conversationId: string, ttlMs: number): Promise<boolean> {
    const now = new Date();
    const rows = await this.db
      .update(conversations)
      .set({ agentLockedUntil: new Date(now.getTime() + ttlMs) })
      .where(
        and(
          eq(conversations.id, conversationId),
          or(isNull(conversations.agentLockedUntil), lte(conversations.agentLockedUntil, now)),
        ),
      )
      .returning({ id: conversations.id });
    return rows.length > 0;
  }

  async unlockAgent(conversationId: string): Promise<void> {
    await this.db
      .update(conversations)
      .set({ agentLockedUntil: null })
      .where(eq(conversations.id, conversationId));
  }

  /** Atualiza o estado do card de rascunho nas mensagens que o exibem. */
  async syncDraftState(draftId: string, state: "confirmed" | "cancelled"): Promise<void> {
    const probe = JSON.stringify([{ kind: "draft", draftId }]);
    const rows = await this.db
      .select()
      .from(messages)
      .where(sql`${messages.attachments} @> ${probe}::jsonb`);

    for (const row of rows) {
      const attachments: MessageAttachment[] = row.attachments.map((a) =>
        a.kind === "draft" && a.draftId === draftId ? { ...a, state } : a,
      );
      await this.db.update(messages).set({ attachments }).where(eq(messages.id, row.id));
    }
  }

  /** Lock de linha: dois analistas assumindo ao mesmo tempo não passam juntos. */
  private async transition(
    conversationId: string,
    action: ConversationAction,
    options: TransitionOptions,
  ): Promise<ConversationRow> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .for("update");

      if (!current) throw new ConversationNotFoundError();
      options.guard?.(current);

      const status = nextStatus(current.status, action);

      const [updated] = await tx
        .update(conversations)
        .set({ ...options.changes, status, updatedAt: new Date() })
        .where(eq(conversations.id, conversationId))
        .returning();

      await tx.insert(messages).values({
        conversationId,
        author: "system",
        authorId: null,
        authorName: null,
        content: options.message,
      });

      if (!updated) throw new ConversationNotFoundError();
      return updated;
    });
  }
}