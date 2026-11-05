import { and, eq, sql, ticketDrafts, type Database, type TicketDraftRow } from "@nexo/db";
import type { DraftRecord, DraftState, DraftStore, NewDraft } from "../ports";

const toRecord = (row: TicketDraftRow): DraftRecord => ({
  id: row.id,
  conversationId: row.conversationId,
  employeeId: row.employeeId,
  mode: row.mode,
  targetTicketId: row.targetTicketId,
  payload: row.payload,
  note: row.note,
  state: row.state,
  createdAt: row.createdAt,
});

export class PostgresDraftStore implements DraftStore {
  constructor(private readonly db: Database) {}

  async create(input: NewDraft): Promise<DraftRecord> {
    const result = await this.db.execute<{ n: string }>(sql`select nextval('draft_number_seq') as n`);
    const next = result[0]?.n;
    if (!next) throw new Error("Não foi possível gerar o número do rascunho.");

    const [row] = await this.db.insert(ticketDrafts).values({ id: `D-${next}`, ...input }).returning();
    if (!row) throw new Error("Falha ao salvar o rascunho.");
    return toRecord(row);
  }

  async findPending(conversationId: string, draftId: string): Promise<DraftRecord | null> {
    const [row] = await this.db
      .select()
      .from(ticketDrafts)
      .where(
        and(
          eq(ticketDrafts.id, draftId),
          eq(ticketDrafts.conversationId, conversationId),
          eq(ticketDrafts.state, "pending"),
        ),
      )
      .limit(1);
    return row ? toRecord(row) : null;
  }

  async markDecided(draftId: string, state: Exclude<DraftState, "pending">): Promise<void> {
    await this.db
      .update(ticketDrafts)
      .set({ state, decidedAt: new Date() })
      .where(and(eq(ticketDrafts.id, draftId), eq(ticketDrafts.state, "pending")));
  }
}