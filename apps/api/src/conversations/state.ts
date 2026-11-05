import { CONVERSATION_STATUS_LABELS, type ConversationStatus } from "@nexo/shared";

export const CONVERSATION_ACTIONS = ["handoff", "take", "release", "close"] as const;
export type ConversationAction = (typeof CONVERSATION_ACTIONS)[number];

const ALLOWED_FROM: Record<ConversationAction, readonly ConversationStatus[]> = {
  handoff: ["with_agent"],
  take: ["waiting_human", "with_agent"],
  release: ["with_human", "waiting_human"],
  close: ["with_agent", "waiting_human", "with_human"],
};

const TARGET: Record<ConversationAction, ConversationStatus> = {
  handoff: "waiting_human",
  take: "with_human",
  release: "with_agent",
  close: "closed",
};

const ACTION_LABELS: Record<ConversationAction, string> = {
  handoff: "transferida",
  take: "assumida",
  release: "devolvida ao agent",
  close: "encerrada",
};

export class ConversationError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "conflict",
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ConversationNotFoundError extends ConversationError {
  constructor() {
    super("Conversa não encontrada.", "not_found");
  }
}

export class InvalidTransitionError extends ConversationError {
  constructor(from: ConversationStatus, action: ConversationAction) {
    super(
      `Esta conversa não pode ser ${ACTION_LABELS[action]} agora (${CONVERSATION_STATUS_LABELS[from]}).`,
      "conflict",
    );
  }
}

export function nextStatus(from: ConversationStatus, action: ConversationAction): ConversationStatus {
  if (!ALLOWED_FROM[action].includes(from)) throw new InvalidTransitionError(from, action);
  return TARGET[action];
}

/** Anexo A: o agent não responde enquanto a conversa está com um analista. */
export function agentCanReply(status: ConversationStatus): boolean {
  return status === "with_agent";
}