"use client";

import { ArrowLeft, Bot, CircleCheckBig, FileText, Hand, Headset, Link2, PanelRight, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HANDOFF_REASON_LABELS, type Conversation, type Message } from "@nexo/shared";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ApiRequestError, errorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { Avatar } from "./avatar";
import { ConsoleMessages } from "./console-messages";
import { useConsoleActions, useConsoleConversation } from "./console-api";
import { HeaderMenu } from "./header-menu";
import { TakeoverBar } from "./takeover-bar";
import { TicketHistory, type ConversationEvent } from "./ticket-history";

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function ModePill({ conversation }: { conversation: Conversation }) {
  const mode = (() => {
    switch (conversation.status) {
      case "waiting_human":
        return { label: "Aguardando atendente", box: "bg-warning-soft text-warning-text", icon: <Hand aria-hidden className="size-3.5" /> };
      case "with_human":
        return { label: "Outro analista atendendo", box: "bg-desk text-ink-2", icon: <Headset aria-hidden className="size-3.5" /> };
      case "with_agent":
        return { label: "Agent atendendo", box: "bg-success-soft text-success-text", icon: <Bot aria-hidden className="size-3.5" /> };
      case "closed":
        return { label: "Encerrada", box: "bg-desk text-ink-3", icon: <CircleCheckBig aria-hidden className="size-3.5" /> };
    }
  })();

  return (
    <span className={cn("hidden shrink-0 items-center gap-[7px] rounded-full px-[11px] py-1.5 text-[12.5px] font-semibold sm:flex", mode.box)}>
      {mode.icon}
      {mode.label}
    </span>
  );
}

/** Resumo do caso que o agent enviou na transferência (Anexo A). */
function HandoffSummary({ conversation }: { conversation: Conversation }) {
  if (!conversation.handoffSummary || conversation.status === "with_agent") return null;

  return (
    <div className="shrink-0 border-b border-rule bg-paper px-5 py-3">
      <div className="flex items-start gap-3 rounded-xl bg-desk px-4 py-3">
        <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
        <div className="min-w-0 text-[13.5px]">
          <p className="flex flex-wrap items-center gap-x-2 font-semibold">
            Resumo da transferência
            {conversation.handoffReason && (
              <span className="rounded-md bg-warning-soft px-1.5 py-px text-[11.5px] text-warning-text">
                {HANDOFF_REASON_LABELS[conversation.handoffReason]}
              </span>
            )}
            {conversation.handoffAt && <span className="text-[12px] font-normal text-ink-3">{formatTime(conversation.handoffAt)}</span>}
          </p>
          <p className="mt-0.5 leading-normal text-ink-2">{conversation.handoffSummary}</p>
        </div>
      </div>
    </div>
  );
}

/** Último evento da conversa, a partir das mensagens de sistema do ConversationService. */
function describeLastEvent(messages: Message[]): ConversationEvent | null {
  const event = messages.findLast((m) => m.author === "system");
  if (!event) return null;

  const text = event.content;
  const at = event.createdAt;

  if (text.includes(" assumiu")) return { label: `Assumido por ${text.split(" assumiu")[0]}`, at, icon: "headset" };
  if (text.startsWith("Transferida")) return { label: "Transferido para um analista", at, icon: "transfer" };
  if (text.includes("devolveu")) return { label: "Devolvido ao agent", at, icon: "bot" };
  if (text.startsWith("Atendimento encerrado")) return { label: "Atendimento encerrado", at, icon: "closed" };
  return { label: text, at, icon: "transfer" };
}

function SearchBar({ value, onChange, count, onClose }: { value: string; onChange: (v: string) => void; count: number; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 border-b border-rule bg-paper px-5 py-2">
      <Search aria-hidden className="size-4 text-ink-3" />
      <label htmlFor="conversation-search" className="sr-only">
        Buscar nesta conversa
      </label>
      <input
        id="conversation-search"
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        placeholder="Buscar nesta conversa"
        className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-3"
      />
      {value.trim() && (
        <span role="status" className="text-[12.5px] text-ink-3">
          {count} {count === 1 ? "resultado" : "resultados"}
        </span>
      )}
      <button type="button" onClick={onClose} aria-label="Fechar busca" className="flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-desk">
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}

export function ConversationView({ conversationId }: { conversationId: string }) {
  const analyst = useCurrentUser();
  const detail = useConsoleConversation(conversationId);
  const actions = useConsoleActions(conversationId);

  const [showTickets, setShowTickets] = useState(true);
  const [confirmClose, setConfirmClose] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  if (detail.isPending) {
    return (
      <div role="status" className="flex flex-1 items-center justify-center gap-2 bg-chat text-[14px] text-ink-3">
        <Spinner />
        Carregando conversa
      </div>
    );
  }

  if (detail.isError && !detail.data) {
    const notFound = detail.error instanceof ApiRequestError && detail.error.status === 404;
    return (
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 bg-chat px-4 text-center">
        <p className="text-[15px] text-ink-2">
          {notFound ? "Conversa não encontrada." : errorMessage(detail.error, "Não foi possível carregar a conversa.")}
        </p>
        {notFound ? (
          <Link href="/console" className="text-[14px] font-medium text-primary-text hover:underline">
            Voltar para a lista
          </Link>
        ) : (
          <Button onClick={() => void detail.refetch()}>Tentar de novo</Button>
        )}
      </div>
    );
  }

  const { conversation, employee, messages, tickets } = detail.data;
  const firstName = employee.name.split(" ")[0] ?? employee.name;
  const mine = conversation.status === "with_human" && conversation.assignedAnalystId === analyst.id;

  const lastEmployeeMessage = messages.findLast((m) => m.author === "employee");
  const online = lastEmployeeMessage ? Date.now() - new Date(lastEmployeeMessage.createdAt).getTime() < ONLINE_WINDOW_MS : false;
  const meta = [online ? "online" : null, employee.department, conversation.ticketId].filter(Boolean).join(" · ");

  const term = search.trim().toLowerCase();
  const matches = term ? messages.filter((m) => m.author !== "system" && m.content.toLowerCase().includes(term)).length : 0;

  const run = (mutation: { mutate: (v: undefined, o: { onError: (e: unknown) => void; onSuccess: () => void }) => void }) => {
    setActionError(null);
    mutation.mutate(undefined, {
      onError: (error) => setActionError(errorMessage(error)),
      onSuccess: () => setConfirmClose(false),
    });
  };

  async function send(content: string): Promise<boolean> {
    setActionError(null);
    try {
      await actions.send.mutateAsync(content);
      return true;
    } catch (error) {
      setActionError(errorMessage(error));
      return false;
    }
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearch("");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice("Link da conversa copiado.");
    } catch {
      setNotice("Não foi possível copiar o link.");
    }
  }

  return (
    <div className="flex min-w-0 flex-1">
      <section aria-label={`Conversa com ${employee.name}`} className="flex min-w-0 flex-1 flex-col bg-chat">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-rule bg-paper pr-4 pl-3 sm:pl-5">
          <Link href="/console" aria-label="Voltar" className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-desk lg:hidden">
            <ArrowLeft aria-hidden className="size-[18px]" />
          </Link>
          <Avatar name={employee.name} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15.5px] font-semibold">{employee.name}</p>
            <p className="truncate text-[12.5px] text-ink-3">{meta}</p>
          </div>

          {mine ? (
            <>
              <Button size="sm" onClick={() => run(actions.release)} loading={actions.release.isPending}>
                {!actions.release.isPending && <Bot aria-hidden className="size-3.5 text-ink-2" />}
                <span className="hidden md:inline">Devolver ao agent</span>
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => (confirmClose ? run(actions.close) : setConfirmClose(true))}
                onBlur={() => setConfirmClose(false)}
                loading={actions.close.isPending}
              >
                {!actions.close.isPending && <CircleCheckBig aria-hidden className="size-3.5" />}
                <span className="hidden md:inline">{confirmClose ? "Confirmar encerramento" : "Encerrar atendimento"}</span>
              </Button>
            </>
          ) : (
            <>
              <ModePill conversation={conversation} />
              <button
                type="button"
                onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
                aria-label="Buscar na conversa"
                aria-pressed={searchOpen}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-desk",
                  searchOpen && "bg-desk",
                )}
              >
                <Search aria-hidden className="size-[18px]" />
              </button>
            </>
          )}

          <HeaderMenu
            items={[
              {
                label: showTickets ? `Ocultar chamados de ${firstName}` : `Mostrar chamados de ${firstName}`,
                icon: PanelRight,
                onSelect: () => setShowTickets((v) => !v),
              },
              { label: "Buscar na conversa", icon: Search, onSelect: () => setSearchOpen(true) },
              { label: "Copiar link da conversa", icon: Link2, onSelect: () => void copyLink() },
            ]}
          />
        </header>

        {searchOpen && <SearchBar value={search} onChange={setSearch} count={matches} onClose={closeSearch} />}

        <HandoffSummary conversation={conversation} />

        {actionError && (
          <div role="alert" className="mx-5 mt-3 flex items-start gap-3 rounded-xl bg-danger-soft px-4 py-2.5 text-[13.5px] text-danger-text">
            <p className="flex-1">{actionError}</p>
            <button type="button" onClick={() => setActionError(null)} aria-label="Fechar aviso" className="rounded p-0.5 hover:bg-danger/10">
              <X aria-hidden className="size-4" />
            </button>
          </div>
        )}

        {notice && (
          <p role="status" className="mx-5 mt-3 rounded-xl bg-paper px-4 py-2.5 text-[13.5px] text-ink-2 shadow-control">
            {notice}
          </p>
        )}

        <ConsoleMessages messages={messages} highlight={searchOpen ? search : ""} />

        <TakeoverBar
          conversation={conversation}
          employeeFirstName={firstName}
          mine={mine}
          pending={{ take: actions.take.isPending, release: actions.release.isPending, send: actions.send.isPending }}
          onTake={() => run(actions.take)}
          onRelease={() => run(actions.release)}
          onSend={send}
        />
      </section>

      {showTickets && (
        <TicketHistory
          className="hidden xl:flex"
          firstName={firstName}
          tickets={tickets}
          currentTicketId={conversation.ticketId}
          lastEvent={describeLastEvent(messages)}
          onClose={() => setShowTickets(false)}
        />
      )}
    </div>
  );
}