import type { Category, SupportLevel, TicketDraft, TicketEventView, TicketView } from "@nexo/shared";

export type { TicketEventView, TicketView };

export interface Actor {
  id: string | null;
  name: string;
}

export interface ListOptions {
  includeClosed?: boolean;
}

export interface SimilarityProbe {
  title: string;
  category?: Category;
}

export interface SimilarTicket {
  ticket: TicketView;
  score: number;
}

export interface CreateOptions {
  actor: Actor;
  /** Id do rascunho confirmado: torna a criação idempotente. */
  sourceDraftId?: string;
}

export interface TransferInput {
  level: SupportLevel;
  summary: string;
  actor: Actor;
}

/**
 * Contrato do serviço de chamados. Toda operação recebe o solicitante:
 * a privacidade é garantida aqui, não no prompt do agent.
 */
export interface TicketService {
  listForRequester(requesterId: string, options?: ListOptions): Promise<TicketView[]>;
  getForRequester(requesterId: string, ticketId: string): Promise<TicketView>;
  listEvents(requesterId: string, ticketId: string): Promise<TicketEventView[]>;
  findSimilar(requesterId: string, probe: SimilarityProbe): Promise<SimilarTicket[]>;
  create(requesterId: string, draft: TicketDraft, options: CreateOptions): Promise<TicketView>;
  addComment(requesterId: string, ticketId: string, body: string, actor: Actor): Promise<TicketView>;
  reopen(requesterId: string, ticketId: string, reason: string, actor: Actor): Promise<TicketView>;
  transfer(requesterId: string, ticketId: string, input: TransferInput): Promise<TicketView>;
}