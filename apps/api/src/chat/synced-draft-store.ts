import type { DraftRecord, DraftState, DraftStore, NewDraft } from "@nexo/agent";
import type { ConversationService } from "../conversations/conversation-service";

/** Decorador: ao decidir um rascunho, também atualiza o card dele nas mensagens. */
export class SyncedDraftStore implements DraftStore {
  constructor(
    private readonly inner: DraftStore,
    private readonly conversations: ConversationService,
  ) {}

  create(input: NewDraft): Promise<DraftRecord> {
    return this.inner.create(input);
  }

  findPending(conversationId: string, draftId: string): Promise<DraftRecord | null> {
    return this.inner.findPending(conversationId, draftId);
  }

  async markDecided(draftId: string, state: Exclude<DraftState, "pending">): Promise<void> {
    await this.inner.markDecided(draftId, state);
    await this.conversations.syncDraftState(draftId, state);
  }
}