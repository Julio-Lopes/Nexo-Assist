"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Conversation, Message, TicketView, User } from "@nexo/shared";
import { api } from "@/lib/api-client";

export const CONSOLE_FILTERS = [
  { id: "all", label: "Todas" },
  { id: "for_you", label: "Para você" },
  { id: "with_agent", label: "Com o agent" },
  { id: "mine", label: "Minhas" },
] as const;

export type ConsoleFilter = (typeof CONSOLE_FILTERS)[number]["id"];

export interface ConsoleItem {
  conversation: Conversation;
  employee: { id: string; name: string; department: string };
  lastMessage: Message | null;
}

export interface ConsoleListPayload {
  filter: ConsoleFilter;
  counts: Record<ConsoleFilter, number>;
  items: ConsoleItem[];
}

export interface ConsoleDetailPayload {
  conversation: Conversation;
  employee: User;
  messages: Message[];
  tickets: TicketView[];
}

const consoleKey = ["console"] as const;

export function useConsoleList(filter: ConsoleFilter) {
  return useQuery({
    queryKey: [...consoleKey, "list", filter],
    queryFn: () => api<ConsoleListPayload>(`/console/conversations?filter=${filter}`),
    refetchInterval: 5_000,
    placeholderData: keepPreviousData,
  });
}

export function useConsoleConversation(conversationId: string) {
  return useQuery({
    queryKey: [...consoleKey, "conversation", conversationId],
    queryFn: () => api<ConsoleDetailPayload>(`/console/conversations/${conversationId}`),
    refetchInterval: 4_000,
  });
}

export function useConsoleActions(conversationId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: consoleKey });
  const post = (path: string, json?: unknown) =>
    api<unknown>(`/console/conversations/${conversationId}${path}`, { method: "POST", json });

  return {
    take: useMutation({ mutationFn: () => post("/take"), onSettled: refresh }),
    release: useMutation({ mutationFn: () => post("/release"), onSettled: refresh }),
    close: useMutation({ mutationFn: () => post("/close"), onSettled: refresh }),
    send: useMutation({ mutationFn: (content: string) => post("/messages", { content }), onSettled: refresh }),
  };
}