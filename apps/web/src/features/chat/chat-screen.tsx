"use client";

import { Headset, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SYSTEM_OPTION_IDS, type ConversationStatus, type Message } from "@nexo/shared";
import { TopBar } from "@/components/shell/top-bar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/auth";
import type { Interaction } from "./agent-message";
import { useConversationQuery, useMyTickets, type ConversationPayload } from "./chat-api";
import { Composer } from "./composer";
import { ConversationBanner } from "./conversation-banner";
import { MessageList } from "./message-list";
import { CONVERSATION_PILL } from "./styles";
import { useChat } from "./use-chat";

function StatusPill({ status }: { status: ConversationStatus }) {
  const pill = CONVERSATION_PILL[status];
  return (
    <span className={`flex shrink-0 items-center gap-[7px] rounded-full px-2.5 py-[5px] text-[12.5px] font-semibold ${pill.box}`}>
      <span aria-hidden className={`size-[7px] rounded-full ${pill.dot}`} />
      {pill.label}
    </span>
  );
}

function findPendingDraftId(messages: Message[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const draft = messages[i]?.attachments.find((a) => a.kind === "draft" && a.state === "pending");
    if (draft?.kind === "draft") return draft.draftId;
  }
  return null;
}

function ChatView({ initial, onRestart }: { initial: ConversationPayload; onRestart: () => void }) {
  const user = useCurrentUser();
  const tickets = useMyTickets();
  const { state, send, confirmDraft, cancelDraft, requestHandoff, dismissError } = useChat(initial);

  const [text, setText] = useState("");
  const [shortcut, setShortcut] = useState("Ctrl ↵");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setShortcut("⌘↵");
  }, []);

  const status = state.conversation.status;
  const idle = !state.turn && !state.busyAction;
  const canInteract = status === "with_agent" && idle;
  const limitReached = state.usage.used >= state.usage.limit;
  const pendingDraftId = useMemo(() => findPendingDraftId(state.messages), [state.messages]);

  const handleSend = useCallback(
    async (value: string) => {
      setText("");
      const accepted = await send(value);
      if (!accepted) setText(value);
    },
    [send],
  );

  const handleSystemOption = useCallback(
    (id: string) => {
      if (id === SYSTEM_OPTION_IDS.handoff) void requestHandoff();
      if (id === SYSTEM_OPTION_IDS.retry) {
        const last = state.messages.findLast((m) => m.author === "employee");
        if (last) void send(last.content);
      }
    },
    [requestHandoff, send, state.messages],
  );

  // Ctrl/⌘ + Enter confirma o rascunho pendente quando o campo está vazio.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
      if (!pendingDraftId || !canInteract || text.trim()) return;
      event.preventDefault();
      void confirmDraft(pendingDraftId);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingDraftId, canInteract, text, confirmDraft]);

  const interaction: Interaction = {
    canInteract,
    busyAction: state.busyAction,
    shortcut,
    onSend: (value) => void handleSend(value),
    onSystemOption: handleSystemOption,
    onConfirmDraft: (id) => void confirmDraft(id),
    onCancelDraft: (id) => void cancelDraft(id),
    onEditDraft: () => {
      setText("Quero ajustar o rascunho: ");
      inputRef.current?.focus();
    },
  };

  const notice = limitReached
    ? "Limite de mensagens atingido. Saia e entre de novo para continuar."
    : state.turn
      ? "O assistente está respondendo…"
      : null;

  return (
    <>
      <TopBar
        title="Atendimento"
        right={
          <div className="flex items-center gap-2">
            {status === "with_agent" && (
              <Button variant="ghost" size="sm" onClick={() => void requestHandoff()} loading={state.busyAction === "handoff"} disabled={!idle}>
                {state.busyAction !== "handoff" && <Headset aria-hidden className="size-3.5" />}
                <span className="hidden sm:inline">Falar com um analista</span>
              </Button>
            )}
            <StatusPill status={status} />
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <MessageList
          firstName={user.name.split(" ")[0] ?? user.name}
          messages={state.messages}
          turn={state.turn}
          tickets={tickets.data}
          ticketsLoading={tickets.isPending}
          interaction={interaction}
        />

        <div className="px-4 pt-2.5 pb-[18px] md:px-8">
          <div className="mx-auto flex max-w-[760px] flex-col gap-2.5">
            {state.error && (
              <div role="alert" className="flex items-start gap-3 rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] text-danger-text">
                <p className="flex-1">{state.error}</p>
                <button type="button" onClick={dismissError} aria-label="Fechar aviso" className="rounded p-0.5 hover:bg-danger/10">
                  <X aria-hidden className="size-4" />
                </button>
              </div>
            )}
            <ConversationBanner status={status} onRestart={onRestart} />
            <Composer
              value={text}
              onChange={setText}
              onSubmit={(value) => void handleSend(value)}
              inputRef={inputRef}
              placeholder={status === "with_agent" ? "Escreva para o Nexo…" : "Escreva para o analista…"}
              disabled={status === "closed" || limitReached}
              sending={state.turn !== null}
              usage={state.usage}
              notice={notice}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export function ChatScreen() {
  const query = useConversationQuery();

  if (query.isPending) {
    return (
      <>
        <TopBar title="Atendimento" />
        <div role="status" className="flex flex-1 items-center justify-center gap-2 text-[14px] text-ink-3">
          <Spinner />
          Carregando sua conversa
        </div>
      </>
    );
  }

  if (query.isError) {
    return (
      <>
        <TopBar title="Atendimento" />
        <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-[15px] text-ink-2">{errorMessage(query.error, "Não foi possível carregar sua conversa.")}</p>
          <Button onClick={() => void query.refetch()}>Tentar de novo</Button>
        </div>
      </>
    );
  }

  // A key remonta o chat quando uma conversa nova começa (depois de encerrada).
  return <ChatView key={query.data.conversation.id} initial={query.data} onRestart={() => void query.refetch()} />;
}