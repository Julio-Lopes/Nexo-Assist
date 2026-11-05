import type { Conversation, Message } from "./domain/conversation";
import type { AgentStep } from "./domain/decision";

export interface MessageUsage {
  used: number;
  limit: number;
}

/** Eventos do chat em streaming (SSE). O nome do evento é o campo "type". */
export type ChatStreamEvent =
  | { type: "user-message"; message: Message; usage: MessageUsage }
  | { type: "step"; step: AgentStep }
  | { type: "text"; delta: string }
  | { type: "agent-message"; message: Message; followUps: Message[]; conversation: Conversation }
  | { type: "paused"; conversation: Conversation }
  | { type: "error"; code: string; message: string }
  | { type: "done" };

/** Resposta das ações por botão (confirmar, cancelar, pedir analista). */
export interface ChatActionResponse {
  messages: Message[];
  conversation: Conversation;
}

/** Opções criadas pelo sistema que a interface trata como ação, não como texto. */
export const SYSTEM_OPTION_IDS = {
  retry: "action:retry",
  handoff: "action:handoff",
} as const;