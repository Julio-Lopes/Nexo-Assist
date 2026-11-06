"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { HANDOFF_REASON_LABELS, type Message } from "@nexo/shared";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatListTime, timeAgo } from "@/lib/format";
import { Avatar } from "./avatar";
import { CONSOLE_FILTERS, type ConsoleFilter, type ConsoleItem, type ConsoleListPayload } from "./console-api";

function preview(message: Message | null): string {
  if (!message) return "Sem mensagens ainda";
  switch (message.author) {
    case "agent":
      return `Nexo: ${message.content}`;
    case "analyst":
      return `${message.authorName?.split(" ")[0] ?? "Analista"}: ${message.content}`;
    default:
      return message.content;
  }
}

function tagFor(item: ConsoleItem, analystId: string) {
  const c = item.conversation;
  switch (c.status) {
    case "waiting_human": {
      const reason = c.handoffReason ? HANDOFF_REASON_LABELS[c.handoffReason] : "Transferida";
      const extra = c.ticketId ? ` · ${c.ticketId}` : c.handoffAt ? ` · ${timeAgo(c.handoffAt)}` : "";
      const asked = c.handoffReason === "low_confidence";
      return {
        label: `${reason}${extra}`,
        dot: asked ? "bg-warning" : "bg-danger",
        text: asked ? "text-warning-text" : "text-danger-text",
        urgent: true,
      };
    }
    case "with_human":
      return c.assignedAnalystId === analystId
        ? { label: "Você está atendendo", dot: "bg-cta", text: "text-primary-text", urgent: false }
        : { label: "Outro analista atendendo", dot: "bg-primary", text: "text-ink-3", urgent: false };
    case "with_agent":
      return { label: "Agent atendendo", dot: "bg-success", text: "text-ink-3", urgent: false };
    case "closed":
      return { label: "Encerrada", dot: "bg-ink/30", text: "text-ink-3", urgent: false };
  }
}

const EMPTY_TEXT: Record<ConsoleFilter, string> = {
  for_you: "Ninguém está esperando por um analista agora.",
  with_agent: "Nenhuma conversa com o agent no momento.",
  mine: "Você não está atendendo nenhuma conversa.",
  all: "Nenhuma conversa ainda.",
};

interface ConversationListProps {
  className?: string;
  filter: ConsoleFilter;
  onFilterChange: (filter: ConsoleFilter) => void;
  query: UseQueryResult<ConsoleListPayload>;
  selectedId: string | null;
}

export function ConversationList({ className, filter, onFilterChange, query, selectedId }: ConversationListProps) {
  const analyst = useCurrentUser();
  const [search, setSearch] = useState("");

  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = query.data?.items ?? [];
    if (!term) return all;
    return all.filter(
      (item) =>
        item.employee.name.toLowerCase().includes(term) ||
        item.conversation.ticketId?.toLowerCase().includes(term) ||
        item.lastMessage?.content.toLowerCase().includes(term),
    );
  }, [query.data, search]);

  return (
    <section
      aria-label="Conversas"
      className={cn("w-full shrink-0 flex-col border-r border-rule lg:w-[380px]", className)}
    >
      <div className="flex flex-col gap-3 px-4 pt-4 pb-2.5">
        <div className="flex items-center gap-2">
          <h1 className="flex-1 text-xl font-bold tracking-[-0.3px]">Conversas</h1>
          <span className="flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-[5px] text-[12.5px] font-semibold text-success-text">
            <span aria-hidden className="size-[7px] rounded-full bg-success" />
            Disponível
          </span>
        </div>

        <label className="flex h-9 items-center gap-2.5 rounded-full bg-desk px-3">
          <Search aria-hidden className="size-[15px] text-ink-3" />
          <span className="sr-only">Pesquisar</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar conversa ou chamado"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-ink-3"
          />
        </label>

        <div role="tablist" aria-label="Filtros" className="flex flex-wrap gap-1">
          {CONSOLE_FILTERS.map(({ id, label }) => {
            const active = filter === id;
            const count = id === "all" ? null : query.data?.counts[id];
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilterChange(id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-[9px] py-1.5 text-[12.5px] font-medium transition-colors",
                  active ? "bg-primary-soft text-primary-text" : "bg-desk text-ink-2 hover:bg-ink/6",
                )}
              >
                {label}
                {count !== null && count !== undefined && (
                  <span className={cn("font-semibold", active ? "text-primary-text" : "text-ink-3")}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {query.isPending && (
          <p role="status" className="flex items-center justify-center gap-2 py-10 text-[13.5px] text-ink-3">
            <Spinner />
            Carregando conversas
          </p>
        )}

        {query.isError && !query.data && (
          <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center text-[13.5px] text-ink-2">
            {errorMessage(query.error, "Não foi possível carregar as conversas.")}
            <Button size="sm" onClick={() => void query.refetch()}>
              Tentar de novo
            </Button>
          </div>
        )}

        {query.data && items.length === 0 && (
          <p className="px-4 py-10 text-center text-[13.5px] text-ink-3">
            {search ? "Nenhuma conversa encontrada." : EMPTY_TEXT[filter]}
          </p>
        )}

        <ul className="flex flex-col">
          {items.map((item) => {
            const tag = tagFor(item, analyst.id);
            const selected = item.conversation.id === selectedId;
            const when = item.lastMessage?.createdAt ?? item.conversation.updatedAt;

            return (
              <li key={item.conversation.id}>
                <Link
                  href={`/console/${item.conversation.id}`}
                  aria-current={selected ? "page" : undefined}
                  className={cn("flex items-center gap-3 rounded-xl p-2.5 transition-colors", selected ? "bg-desk" : "hover:bg-desk/60")}
                >
                  <Avatar name={item.employee.name} />
                  <div className={cn("flex min-w-0 flex-1 flex-col gap-[3px] pb-2.5", !selected && "border-b border-rule")}>
                    <div className="flex items-center gap-2">
                      <span className={cn("min-w-0 flex-1 truncate text-[15.5px]", tag.urgent ? "font-semibold" : "font-medium")}>
                        {item.employee.name}
                      </span>
                      <span className={cn("text-[12.5px]", tag.urgent ? "font-semibold text-cta" : "text-ink-3")}>
                        {formatListTime(when)}
                      </span>
                    </div>
                    <p className="truncate text-[13.5px] text-ink-3">{preview(item.lastMessage)}</p>
                    <p className={cn("flex items-center gap-[5px] text-[11.5px] font-medium", tag.text)}>
                      <span aria-hidden className={cn("size-1.5 rounded-full", tag.dot)} />
                      {tag.label}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}