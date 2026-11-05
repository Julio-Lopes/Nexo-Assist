"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { AgentStep, ChatActionResponse, Conversation, Message, MessageUsage } from "@nexo/shared";
import { API_URL, ApiRequestError, api, errorMessage } from "@/lib/api-client";
import { sessionKey } from "@/lib/auth";
import { myTicketsKey, type ConversationPayload, type MessagesPayload } from "./chat-api";
import { readSse } from "./sse";

export interface PendingTurn {
  text: string;
  userMessage: Message | null;
  steps: AgentStep[];
  reply: string;
}

export interface ChatState {
  conversation: Conversation;
  messages: Message[];
  usage: MessageUsage;
  turn: PendingTurn | null;
  busyAction: string | null;
  error: string | null;
}

type Action =
  | { type: "merge"; messages: Message[]; conversation?: Conversation }
  | { type: "replace"; messages: Message[]; conversation: Conversation }
  | { type: "turn-start"; text: string }
  | { type: "turn-user"; message: Message; usage: MessageUsage }
  | { type: "turn-step"; step: AgentStep }
  | { type: "turn-text"; delta: string }
  | { type: "turn-end" }
  | { type: "busy"; action: string | null }
  | { type: "error"; message: string | null };

/** Junta por id e ordena por data: o polling e o streaming podem trazer a mesma mensagem. */
function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case "merge":
      return {
        ...state,
        messages: mergeMessages(state.messages, action.messages),
        conversation: action.conversation ?? state.conversation,
      };
    case "replace":
      return { ...state, messages: mergeMessages([], action.messages), conversation: action.conversation };
    case "turn-start":
      return { ...state, error: null, turn: { text: action.text, userMessage: null, steps: [], reply: "" } };
    case "turn-user":
      return {
        ...state,
        usage: action.usage,
        messages: mergeMessages(state.messages, [action.message]),
        turn: state.turn ? { ...state.turn, userMessage: action.message } : null,
      };
    case "turn-step":
      return state.turn ? { ...state, turn: { ...state.turn, steps: [...state.turn.steps, action.step] } } : state;
    case "turn-text":
      return state.turn ? { ...state, turn: { ...state.turn, reply: state.turn.reply + action.delta } } : state;
    case "turn-end":
      return { ...state, turn: null };
    case "busy":
      return { ...state, busyAction: action.action, error: action.action ? null : state.error };
    case "error":
      return { ...state, error: action.message };
  }
}

export function useChat(initial: ConversationPayload) {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(reducer, {
    conversation: initial.conversation,
    messages: initial.messages,
    usage: initial.usage,
    turn: null,
    busyAction: null,
    error: null,
  });

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const conversationId = state.conversation.id;

  const handleUnauthorized = useCallback(
    (error: unknown) => {
      if (error instanceof ApiRequestError && error.status === 401) queryClient.setQueryData(sessionKey, null);
    },
    [queryClient],
  );

  /** Recarrega a conversa inteira: garante cards e estados iguais aos do servidor. */
  const resync = useCallback(async () => {
    try {
      const data = await api<MessagesPayload>(`/me/conversation/${conversationId}/messages`);
      dispatch({ type: "replace", messages: data.messages, conversation: data.conversation });
    } catch (error) {
      handleUnauthorized(error);
    }
    void queryClient.invalidateQueries({ queryKey: myTicketsKey });
  }, [conversationId, handleUnauthorized, queryClient]);

  /** Envia a mensagem e consome o turno em streaming. Retorna se a mensagem foi aceita. */
  const send = useCallback(
    async (text: string): Promise<boolean> => {
      const content = text.trim();
      const current = stateRef.current;
      if (!content || current.turn || current.busyAction || current.conversation.status === "closed") return false;

      dispatch({ type: "turn-start", text: content });
      let accepted = false;

      try {
        let response: Response;
        try {
          response = await fetch(`${API_URL}/me/conversation/${conversationId}/messages`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          });
        } catch {
          throw new ApiRequestError(0, "network", "Sem conexão com o servidor. Verifique sua internet e tente de novo.");
        }

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
          throw new ApiRequestError(
            response.status,
            body?.error?.code ?? "http_error",
            body?.error?.message ?? "Não foi possível enviar sua mensagem.",
          );
        }

        for await (const event of readSse(response)) {
          switch (event.type) {
            case "user-message":
              accepted = true;
              dispatch({ type: "turn-user", message: event.message, usage: event.usage });
              break;
            case "step":
              dispatch({ type: "turn-step", step: event.step });
              break;
            case "text":
              dispatch({ type: "turn-text", delta: event.delta });
              break;
            case "agent-message":
              dispatch({ type: "merge", messages: [event.message, ...event.followUps], conversation: event.conversation });
              break;
            case "paused":
              dispatch({ type: "merge", messages: [], conversation: event.conversation });
              break;
            case "error":
              dispatch({ type: "error", message: event.message });
              break;
            case "done":
              break;
          }
        }
      } catch (error) {
        handleUnauthorized(error);
        dispatch({ type: "error", message: errorMessage(error, "Não foi possível enviar sua mensagem.") });
      } finally {
        dispatch({ type: "turn-end" });
        await resync();
      }

      return accepted;
    },
    [conversationId, handleUnauthorized, resync],
  );

  const runAction = useCallback(
    async (key: string, path: string) => {
      const current = stateRef.current;
      if (current.busyAction || current.turn) return;

      dispatch({ type: "busy", action: key });
      try {
        const result = await api<ChatActionResponse>(path, { method: "POST" });
        dispatch({ type: "merge", messages: result.messages, conversation: result.conversation });
      } catch (error) {
        handleUnauthorized(error);
        dispatch({ type: "error", message: errorMessage(error) });
      } finally {
        dispatch({ type: "busy", action: null });
        await resync();
      }
    },
    [handleUnauthorized, resync],
  );

  const base = `/me/conversation/${conversationId}`;
  const confirmDraft = useCallback((id: string) => runAction(`confirm:${id}`, `${base}/drafts/${id}/confirm`), [base, runAction]);
  const cancelDraft = useCallback((id: string) => runAction(`cancel:${id}`, `${base}/drafts/${id}/cancel`), [base, runAction]);
  const requestHandoff = useCallback(() => runAction("handoff", `${base}/handoff`), [base, runAction]);
  const dismissError = useCallback(() => dispatch({ type: "error", message: null }), []);

  // Polling: rápido com o analista (mensagens dele), lento com o agent (detectar se alguém assumiu).
  const status = state.conversation.status;
  const idle = !state.turn && !state.busyAction;
  const lastCreatedAt = state.messages.at(-1)?.createdAt;

  useEffect(() => {
    if (!idle || status === "closed") return;

    const interval = status === "with_agent" ? 15_000 : 4_000;
    const timer = setInterval(async () => {
      try {
        const query = lastCreatedAt ? `?after=${encodeURIComponent(lastCreatedAt)}` : "";
        const data = await api<MessagesPayload>(`${base}/messages${query}`);
        dispatch({ type: "merge", messages: data.messages, conversation: data.conversation });
      } catch (error) {
        handleUnauthorized(error);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [idle, status, lastCreatedAt, base, handleUnauthorized]);

  return { state, send, confirmDraft, cancelDraft, requestHandoff, dismissError };
}