import {
  TICKET_EVENT_KINDS,
  and,
  asc,
  desc,
  eq,
  inArray,
  sql,
  ticketEvents,
  tickets,
  type Database,
  type TicketRow,
} from "@nexo/db";
import {
  TICKET_STATUSES,
  canReopen,
  isOpenStatus,
  ticketDraftSchema,
  type TicketDraft,
} from "@nexo/shared";
import {
  InvalidTicketStateError,
  TicketNotFoundError,
  TicketValidationError,
} from "./errors";
import { toEventView, toTicketView } from "./mappers";
import { SIMILARITY_MIN, similarity } from "./similarity";
import type {
  Actor,
  CreateOptions,
  ListOptions,
  SimilarTicket,
  SimilarityProbe,
  TicketEventView,
  TicketService,
  TicketView,
  TransferInput,
} from "./types";

type TicketEventKind = (typeof TICKET_EVENT_KINDS)[number];
type TicketChanges = Partial<typeof tickets.$inferInsert>;

const OPEN_STATUSES = TICKET_STATUSES.filter(isOpenStatus);
const MAX_TEXT = 2000;

function requireText(value: string, field: string): string {
  const text = value.trim();
  if (text.length < 3) throw new TicketValidationError(`${field} muito curto.`);
  if (text.length > MAX_TEXT) throw new TicketValidationError(`${field} muito longo.`);
  return text;
}

export class PostgresTicketService implements TicketService {
  constructor(private readonly db: Database) {}

  async listForRequester(requesterId: string, options: ListOptions = {}): Promise<TicketView[]> {
    const filter = options.includeClosed
      ? eq(tickets.requesterId, requesterId)
      : and(eq(tickets.requesterId, requesterId), inArray(tickets.status, OPEN_STATUSES));

    const rows = await this.db.select().from(tickets).where(filter).orderBy(desc(tickets.updatedAt));
    const now = new Date();
    return rows.map((row) => toTicketView(row, now));
  }

  async getForRequester(requesterId: string, ticketId: string): Promise<TicketView> {
    return toTicketView(await this.findOwned(requesterId, ticketId));
  }

  async listEvents(requesterId: string, ticketId: string): Promise<TicketEventView[]> {
    await this.findOwned(requesterId, ticketId);
    const rows = await this.db
      .select()
      .from(ticketEvents)
      .where(eq(ticketEvents.ticketId, ticketId))
      .orderBy(asc(ticketEvents.createdAt));
    return rows.map(toEventView);
  }

  async findSimilar(requesterId: string, probe: SimilarityProbe): Promise<SimilarTicket[]> {
    const rows = await this.db
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.requesterId, requesterId),
          probe.category ? eq(tickets.category, probe.category) : undefined,
        ),
      );

    const now = new Date();
    return rows
      .map((row) => ({ ticket: toTicketView(row, now), score: similarity(probe.title, row.title) }))
      .filter(({ ticket, score }) => (isOpenStatus(ticket.status) || ticket.reopenable) && score >= SIMILARITY_MIN)
      .sort((a, b) => b.score - a.score);
  }

  async create(requesterId: string, draft: TicketDraft, options: CreateOptions): Promise<TicketView> {
    const parsed = ticketDraftSchema.safeParse(draft);
    if (!parsed.success) {
      throw new TicketValidationError("Rascunho incompleto: confira título, descrição e classificação.");
    }
    const data = parsed.data;

    if (options.sourceDraftId) {
      const [existing] = await this.db
        .select()
        .from(tickets)
        .where(eq(tickets.sourceDraftId, options.sourceDraftId))
        .limit(1);

      if (existing) {
        if (existing.requesterId !== requesterId) throw new TicketNotFoundError(existing.id);
        return toTicketView(existing);
      }
    }

    const created = await this.db.transaction(async (tx) => {
      const sequence = data.type === "INC" ? "inc_number_seq" : "req_number_seq";
      const result = await tx.execute<{ n: string }>(sql`select nextval(${sequence}::regclass) as n`);
      const next = result[0]?.n;
      if (!next) throw new Error("Não foi possível gerar o número do chamado.");

      const id = `${data.type}-${String(next).padStart(5, "0")}`;

      const [row] = await tx
        .insert(tickets)
        .values({ id, ...data, requesterId, status: "open", sourceDraftId: options.sourceDraftId ?? null })
        .returning();

      await tx.insert(ticketEvents).values({
        ticketId: id,
        kind: "created",
        authorId: options.actor.id,
        authorName: options.actor.name,
        body: "Chamado aberto.",
      });

      return row;
    });

    if (!created) throw new Error("Falha ao criar o chamado.");
    return toTicketView(created);
  }

  async addComment(requesterId: string, ticketId: string, body: string, actor: Actor): Promise<TicketView> {
    const text = requireText(body, "Comentário");
    const current = await this.findOwned(requesterId, ticketId);

    if (!isOpenStatus(current.status)) {
      throw new InvalidTicketStateError(
        "Este chamado já foi encerrado. Se foi resolvido há até 7 dias, ele pode ser reaberto.",
      );
    }

    const status = current.status === "waiting_employee" ? "waiting_analyst" : current.status;
    return this.mutate(requesterId, ticketId, { status }, { kind: "comment", body: text, actor });
  }

  async reopen(requesterId: string, ticketId: string, reason: string, actor: Actor): Promise<TicketView> {
    const text = requireText(reason, "Motivo");
    const current = await this.findOwned(requesterId, ticketId);

    if (current.status !== "resolved" || !current.resolvedAt) {
      throw new InvalidTicketStateError("Só chamados resolvidos podem ser reabertos.");
    }
    if (!canReopen(current.resolvedAt)) {
      throw new InvalidTicketStateError("Resolvido há mais de 7 dias: é preciso abrir um novo chamado.");
    }

    return this.mutate(
      requesterId,
      ticketId,
      { status: "waiting_analyst", resolvedAt: null },
      { kind: "reopened", body: text, actor },
    );
  }

  async transfer(requesterId: string, ticketId: string, input: TransferInput): Promise<TicketView> {
    const summary = requireText(input.summary, "Resumo");
    const current = await this.findOwned(requesterId, ticketId);

    if (!isOpenStatus(current.status)) {
      throw new InvalidTicketStateError("Chamados encerrados não podem ser transferidos.");
    }

    return this.mutate(
      requesterId,
      ticketId,
      { status: "waiting_analyst" },
      { kind: "transferred", body: `Transferido para Suporte ${input.level}. ${summary}`, actor: input.actor },
    );
  }

  private async findOwned(requesterId: string, ticketId: string): Promise<TicketRow> {
    const [row] = await this.db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.requesterId, requesterId)))
      .limit(1);

    if (!row) throw new TicketNotFoundError(ticketId);
    return row;
  }

  /** Atualiza o chamado e registra o evento na mesma transação. Toda mudança reinicia o prazo. */
  private async mutate(
    requesterId: string,
    ticketId: string,
    changes: TicketChanges,
    event: { kind: TicketEventKind; body: string; actor: Actor },
  ): Promise<TicketView> {
    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(tickets)
        .set({ ...changes, updatedAt: new Date() })
        .where(and(eq(tickets.id, ticketId), eq(tickets.requesterId, requesterId)))
        .returning();

      if (!row) return undefined;

      await tx.insert(ticketEvents).values({
        ticketId,
        kind: event.kind,
        authorId: event.actor.id,
        authorName: event.actor.name,
        body: event.body,
      });

      return row;
    });

    if (!updated) throw new TicketNotFoundError(ticketId);
    return toTicketView(updated);
  }
}