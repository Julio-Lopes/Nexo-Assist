import type { DraftMode, TicketDraft, User } from "@nexo/shared";
import type { KnowledgeService, TicketService } from "@nexo/tickets";
import type { TurnRecorder } from "./recorder";

export type DraftState = "pending" | "confirmed" | "cancelled";

export interface DraftRecord {
  id: string;
  conversationId: string;
  employeeId: string;
  mode: DraftMode;
  targetTicketId: string | null;
  payload: TicketDraft;
  note: string | null;
  state: DraftState;
  createdAt: Date;
}

export type NewDraft = Omit<DraftRecord, "id" | "state" | "createdAt">;

export interface DraftStore {
  create(input: NewDraft): Promise<DraftRecord>;
  findPending(conversationId: string, draftId: string): Promise<DraftRecord | null>;
  markDecided(draftId: string, state: Exclude<DraftState, "pending">): Promise<void>;
}

/** Tudo que o agent usa do mundo externo. A API injeta as implementações reais. */
export interface AgentServices {
  tickets: TicketService;
  knowledge: Pick<KnowledgeService, "search">;
  drafts: DraftStore;
}

export interface TurnContext {
  services: AgentServices;
  employee: User;
  conversationId: string;
  recorder: TurnRecorder;
  now: Date;
}