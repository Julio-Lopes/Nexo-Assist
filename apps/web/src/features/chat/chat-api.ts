"use client";

import { useQuery } from "@tanstack/react-query";
import type { Conversation, Message, MessageUsage, TicketView } from "@nexo/shared";
import { api } from "@/lib/api-client";

export interface ConversationPayload {
  conversation: Conversation;
  messages: Message[];
  usage: MessageUsage;
}

export interface MessagesPayload {
  conversation: Conversation;
  messages: Message[];
}

export const conversationKey = ["conversation"] as const;
export const myTicketsKey = ["my-tickets"] as const;

export function useConversationQuery() {
  return useQuery({
    queryKey: conversationKey,
    queryFn: () => api<ConversationPayload>("/me/conversation"),
    staleTime: Infinity,
  });
}

/** Todos os chamados do funcionário, usados para renderizar os cards. */
export function useMyTickets() {
  return useQuery({
    queryKey: myTicketsKey,
    queryFn: async () => (await api<{ tickets: TicketView[] }>("/me/tickets?all=1")).tickets,
    staleTime: 30_000,
    select: (tickets) => new Map(tickets.map((t) => [t.id, t])),
  });
}