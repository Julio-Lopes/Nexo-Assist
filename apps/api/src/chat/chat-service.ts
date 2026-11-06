import {
  AgentUnavailableError,
  TurnRecorder,
  executeDraft,
  finalizeDecision,
  formatDateTime,
  handoffToAnalyst,
  runAgentTurn,
  type AgentServices,
  type DraftRecord,
  type HandoffRequest,
  type TurnContext,
  type TurnResult,
} from "@nexo/agent";
import type { ConversationRow, MessageRow } from "@nexo/db";
import {
  MESSAGE_LIMIT_PER_SESSION,
  PRIORITY_LABELS,
  SYSTEM_OPTION_IDS,
  type AgentDecision,
  type AgentStep,
  type ChatActionResponse,
  type Conversation,
  type DraftMode,
  type Message,
  type MessageAttachment,
  type MessageUsage,
  type User,
} from "@nexo/shared";
import type { TicketView } from "@nexo/tickets";
import type { ConversationService } from "../conversations/conversation-service";
import { ApiError } from "../http/errors";
import { toConversation, toMessage } from "../http/mappers";
import type { SlidingWindowLimiter } from "../http/rate-limit";

export interface ChatHooks {
  onUserMessage?: (message: Message, usage: MessageUsage) => Promise<void> | void;
  onStep?: (step: AgentStep) => void;
  onText?: (delta: string) => void;
}

export interface PreparedTurn {
  employee: User;
  conversation: ConversationRow;
  used: number;
  locked: boolean;
}

export type TurnOutcome =
  | { kind: "replied"; message: Message; followUps: Message[]; conversation: Conversation }
  | { kind: "paused"; conversation: Conversation };

/** Maior que o timeout total do agent (45 s): a trava expira sozinha se a function morrer. */
const AGENT_LOCK_MS = 60_000;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ChatLimits {
  perMinute: SlidingWindowLimiter;
  perUserPerDay: number;
  globalPerDay: number;
}

const AGENT_NAME = "Nexo Assist";
const UNAVAILABLE_TEXT = "Não consegui responder agora. Você pode tentar de novo ou falar com um analista.";

const RECOVERY_OPTIONS: MessageAttachment = {
  kind: "options",
  question: null,
  options: [
    { id: SYSTEM_OPTION_IDS.retry, label: "Tentar de novo" },
    { id: SYSTEM_OPTION_IDS.handoff, label: "Falar com um analista" },
  ],
};

const unavailableDecision = (): AgentDecision => ({
  intent: "unclear",
  understanding: "Não foi possível interpretar a mensagem: o modelo não respondeu.",
  action: "reply",
  confidence: 0,
  reason: "Falha ou limite do provedor de LLM. A mensagem foi preservada e o funcionário pode tentar de novo ou chamar um analista.",
  rulesApplied: ["Erro do modelo tratado sem perder a conversa"],
  steps: [],
});

function confirmationText(mode: DraftMode, ticket: TicketView): string {
  const due = ticket.dueAt ? ` A próxima resposta deve chegar até ${formatDateTime(new Date(ticket.dueAt))}.` : "";
  switch (mode) {
    case "create":
      return `Pronto: abri o ${ticket.id} com prioridade ${PRIORITY_LABELS[ticket.priority].toLowerCase()}.${due}`;
    case "update":
      return `Pronto: adicionei a informação ao ${ticket.id}.${due}`;
    case "reopen":
      return `Pronto: reabri o ${ticket.id}.${due}`;
  }
}

/** Orquestra os turnos: persistência, trava, agent, transferência e ações por botão. */
export class ChatService {
  constructor(
    private readonly conversations: ConversationService,
    private readonly services: AgentServices,
    private readonly model: string,
    private readonly limits: ChatLimits,
  ) {}

  /** Validações que precisam virar status HTTP antes de o streaming começar. */
  async prepareTurn(employee: User, conversationId: string, sessionStartedAt: Date): Promise<PreparedTurn> {
    const conversation = await this.conversations.getForEmployee(employee.id, conversationId);
    if (conversation.status === "closed") {
      throw new ApiError(409, "conversation_closed", "Esta conversa foi encerrada. Atualize a página para começar outra.");
    }

    const used = await this.conversations.countEmployeeMessagesSince(conversationId, sessionStartedAt);
    if (used >= MESSAGE_LIMIT_PER_SESSION) {
      throw new ApiError(
        429,
        "message_limit",
        `Você chegou ao limite de ${MESSAGE_LIMIT_PER_SESSION} mensagens nesta sessão. Saia e entre de novo para continuar.`,
      );
    }

    if (this.limits.perMinute.take(employee.id) > 0) {
      throw new ApiError(429, "slow_down", "Você está enviando mensagens rápido demais. Aguarde alguns segundos.");
    }

    let locked = false;
    if (conversation.status === "with_agent") {
      // Os tetos diários só valem quando a mensagem vai para o LLM.
      await this.assertDailyQuota(employee.id);
      locked = await this.conversations.tryLockAgent(conversationId, AGENT_LOCK_MS);
      if (!locked) throw new ApiError(409, "turn_in_progress", "Aguarde a resposta anterior terminar.");
    }

    return { employee, conversation, used, locked };
  }

  private async assertDailyQuota(employeeId: string): Promise<void> {
    const since = new Date(Date.now() - DAY_MS);
    const [mine, global] = await Promise.all([
      this.conversations.countEmployeeMessagesForUserSince(employeeId, since),
      this.conversations.countAgentRepliesSince(since),
    ]);

    if (mine >= this.limits.perUserPerDay) {
      throw new ApiError(
        429,
        "daily_user_limit",
        "Você chegou ao limite diário de mensagens do assistente nesta demonstração. Use “Falar com um analista” para continuar.",
      );
    }
    if (global >= this.limits.globalPerDay) {
      throw new ApiError(
        429,
        "daily_quota",
        "O assistente atingiu o limite diário de uso desta demonstração. Você ainda pode falar com um analista.",
      );
    }
  }

  async runTurn(prepared: PreparedTurn, content: string, hooks: ChatHooks = {}): Promise<TurnOutcome> {
    const { employee, conversation } = prepared;
    const id = conversation.id;

    try {
      const history = prepared.locked ? await this.conversations.listMessages(id) : [];
      const userRow = await this.conversations.appendMessage({
        conversationId: id,
        author: "employee",
        authorId: employee.id,
        authorName: employee.name,
        content,
      });
      await hooks.onUserMessage?.(toMessage(userRow), {
        used: prepared.used + 1,
        limit: MESSAGE_LIMIT_PER_SESSION,
      });

      // Anexo A: com um analista na conversa, o agent não responde.
      if (!prepared.locked) return { kind: "paused", conversation: toConversation(conversation) };

      let result: TurnResult;
      try {
        result = await runAgentTurn({
          services: this.services,
          employee,
          conversationId: id,
          history: history.map(toMessage),
          userMessage: content,
          model: this.model,
          onStep: hooks.onStep,
          onText: hooks.onText,
        });
      } catch (error) {
        if (!(error instanceof AgentUnavailableError)) throw error;
        console.error("[chat] modelo indisponível", error.cause);
        const message = await this.saveAgentMessage(id, UNAVAILABLE_TEXT, [RECOVERY_OPTIONS], unavailableDecision());
        return { kind: "replied", message: toMessage(message), followUps: [], conversation: toConversation(conversation) };
      }

      // Um analista pode ter assumido durante o turno: a resposta do agent é descartada.
      const current = await this.conversations.getForEmployee(employee.id, id);
      if (current.status !== "with_agent") return { kind: "paused", conversation: toConversation(current) };

      const message = await this.saveAgentMessage(id, result.text, result.attachments, result.decision);
      return this.finish(message, current, result.handoff);
    } finally {
      if (prepared.locked) await this.conversations.unlockAgent(id);
    }
  }

  /** Botão Confirmar: aplica o rascunho sem passar pelo LLM. */
  confirmDraft(employee: User, conversationId: string, draftId: string): Promise<ChatActionResponse> {
    return this.withAgentLock(employee, conversationId, async (conversation) => {
      const draft = await this.requirePendingDraft(conversationId, draftId);
      const ctx = this.context(employee, conversationId);

      const outcome = await executeDraft(ctx, draft);
      let text = confirmationText(draft.mode, outcome.ticket);

      if (outcome.requiresHandoff) {
        await handoffToAnalyst(ctx, {
          reason: "critical",
          summary: `Chamado crítico ${outcome.ticket.id}: ${draft.payload.title}. ${draft.payload.description}`,
          ticketId: outcome.ticket.id,
        });
        text += " Como é crítico, já chamei um analista do Suporte N2.";
      }

      ctx.recorder.declared = {
        intent: draft.mode === "create" ? "ticket_create" : "ticket_update",
        understanding: `Confirmou o rascunho ${draft.id} pelo botão do card.`,
        action: "reply",
        confidence: 1,
        reason: "Confirmação explícita do funcionário: pelo Anexo A, só depois dela o chamado é criado ou alterado.",
        rulesApplied: [
          "Confirmar antes de criar ou atualizar",
          ...(outcome.requiresHandoff ? ["Transferência em caso crítico"] : []),
        ],
      };

      return this.respond(ctx.recorder, conversation, text);
    });
  }

  /** Botão Cancelar do card de rascunho. */
  cancelDraft(employee: User, conversationId: string, draftId: string): Promise<ChatActionResponse> {
    return this.withAgentLock(employee, conversationId, async (conversation) => {
      const draft = await this.requirePendingDraft(conversationId, draftId);
      await this.services.drafts.markDecided(draft.id, "cancelled");

      const recorder = new TurnRecorder();
      recorder.note({ tool: "cancel_draft", label: "descartou o rascunho", status: "success", summary: draft.id });
      recorder.declared = {
        intent: draft.mode === "create" ? "ticket_create" : "ticket_update",
        understanding: `Descartou o rascunho ${draft.id} pelo botão do card.`,
        action: "reply",
        confidence: 1,
        reason: "Nada é criado sem confirmação; o funcionário preferiu não seguir com este rascunho.",
        rulesApplied: ["Confirmar antes de criar ou atualizar"],
      };

      return this.respond(recorder, conversation, "Tudo bem, descartei o rascunho. Se quiser ajustar algo, me diga o que mudar.");
    });
  }

  /** Pedido direto de analista: funciona mesmo com o LLM fora do ar. */
  async requestHandoff(employee: User, conversationId: string): Promise<ChatActionResponse> {
    const current = await this.conversations.getForEmployee(employee.id, conversationId);
    if (current.status === "waiting_human" || current.status === "with_human") {
      return { messages: [], conversation: toConversation(current) };
    }

    return this.withAgentLock(employee, conversationId, async (conversation) => {
      const recent = (await this.conversations.listMessages(conversationId))
        .filter((m) => m.author === "employee")
        .slice(-3)
        .map((m) => `"${m.content}"`)
        .join(" ");

      const ctx = this.context(employee, conversationId);
      await handoffToAnalyst(ctx, {
        reason: "employee_request",
        summary: recent ? `Pediu um analista. Últimas mensagens: ${recent}` : "Pediu um analista pelo chat.",
        ticketId: null,
      });

      ctx.recorder.declared = {
        intent: "handoff_request",
        understanding: "Pediu para falar com um analista.",
        action: "handoff",
        confidence: 1,
        reason: "O Anexo A prevê transferência sempre que o funcionário pede.",
        rulesApplied: ["Transferência a pedido do funcionário"],
      };

      return this.respond(ctx.recorder, conversation, "Encaminhei para um analista do Suporte N1. Ele continua a conversa por aqui.");
    });
  }

  /* ---------- internos ---------- */

  private context(employee: User, conversationId: string): TurnContext {
    return { services: this.services, employee, conversationId, recorder: new TurnRecorder(), now: new Date() };
  }

  private async withAgentLock<T>(
    employee: User,
    conversationId: string,
    run: (conversation: ConversationRow) => Promise<T>,
  ): Promise<T> {
    const conversation = await this.conversations.getForEmployee(employee.id, conversationId);
    if (conversation.status !== "with_agent") {
      throw new ApiError(
        409,
        "not_with_agent",
        conversation.status === "closed" ? "Esta conversa foi encerrada." : "Um analista está cuidando desta conversa.",
      );
    }

    if (!(await this.conversations.tryLockAgent(conversationId, AGENT_LOCK_MS))) {
      throw new ApiError(409, "turn_in_progress", "Aguarde a resposta anterior terminar.");
    }

    try {
      return await run(conversation);
    } finally {
      await this.conversations.unlockAgent(conversationId);
    }
  }

  private async requirePendingDraft(conversationId: string, draftId: string): Promise<DraftRecord> {
    const draft = await this.services.drafts.findPending(conversationId, draftId);
    if (!draft) throw new ApiError(409, "draft_decided", "Este rascunho já foi confirmado ou descartado.");
    return draft;
  }

  private saveAgentMessage(
    conversationId: string,
    content: string,
    attachments: MessageAttachment[],
    decision: AgentDecision,
  ): Promise<MessageRow> {
    return this.conversations.appendMessage({
      conversationId,
      author: "agent",
      authorId: null,
      authorName: AGENT_NAME,
      content,
      attachments,
      decision,
    });
  }

  private async respond(recorder: TurnRecorder, conversation: ConversationRow, text: string): Promise<ChatActionResponse> {
    const { decision } = finalizeDecision(recorder);
    const message = await this.saveAgentMessage(conversation.id, text, recorder.attachments, decision);
    const outcome = await this.finish(message, conversation, recorder.handoff);
    return { messages: [outcome.message, ...outcome.followUps], conversation: outcome.conversation };
  }

  /** Aplica a transferência (se houver) e devolve as mensagens de sistema geradas por ela. */
  private async finish(
    agentMessage: MessageRow,
    conversation: ConversationRow,
    handoff: HandoffRequest | null,
  ): Promise<Extract<TurnOutcome, { kind: "replied" }>> {
    let updated = conversation;
    let followUps: Message[] = [];

    if (handoff) {
      updated = await this.conversations.handoff(conversation.id, {
        reason: handoff.reason,
        summary: `Suporte ${handoff.level} · ${handoff.summary}`,
        ticketId: handoff.ticketId,
      });
      followUps = (await this.conversations.listMessages(conversation.id, agentMessage.createdAt))
        .filter((m) => m.id !== agentMessage.id)
        .map(toMessage);
    }

    return { kind: "replied", message: toMessage(agentMessage), followUps, conversation: toConversation(updated) };
  }
}