"use client";

import { ArrowRightLeft } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { Message, TicketView } from "@nexo/shared";
import { AgentMessage, PendingAgentMessage, type Interaction } from "./agent-message";
import type { PendingTurn } from "./use-chat";

const SUGGESTIONS = [
  "Qual o status do meu chamado?",
  "Minha VPN não conecta",
  "Como redefino minha senha?",
  "Preciso instalar um software",
];

function EmployeeBubble({ text, pending = false }: { text: string; pending?: boolean }) {
  return (
    <div className="flex justify-end">
      <p
        className={`max-w-[520px] rounded-[12px_12px_4px_12px] bg-ink px-4 py-[11px] text-[14.5px] leading-[1.45] whitespace-pre-wrap text-white ${pending ? "opacity-70" : ""}`}
      >
        {text}
      </p>
    </div>
  );
}

function AnalystMessage({ message }: { message: Message }) {
  return (
    <article className="flex flex-col gap-1.5">
      <p className="flex items-center gap-2 text-[12.5px]">
        <span className="font-semibold">{message.authorName ?? "Analista"}</span>
        <span className="rounded-md bg-success-soft px-1.5 py-px text-[11px] font-semibold text-success-text">Analista</span>
      </p>
      <div className="w-fit max-w-[600px] rounded-[4px_12px_12px_12px] bg-success-soft px-4 py-3 text-[14.5px] leading-normal whitespace-pre-wrap">
        {message.content}
      </div>
    </article>
  );
}

function SystemEvent({ message }: { message: Message }) {
  return (
    <div className="flex items-center gap-3 py-1 text-[12px] font-medium text-ink-3">
      <span className="h-px flex-1 bg-ink/8" />
      <span className="flex items-center gap-1.5 text-center">
        <ArrowRightLeft aria-hidden className="size-3" />
        {message.content}
      </span>
      <span className="h-px flex-1 bg-ink/8" />
    </div>
  );
}

interface MessageListProps {
  firstName: string;
  messages: Message[];
  turn: PendingTurn | null;
  tickets: Map<string, TicketView> | undefined;
  ticketsLoading: boolean;
  interaction: Interaction;
}

export function MessageList({ firstName, messages, turn, tickets, ticketsLoading, interaction }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const lastAgentId = useMemo(() => messages.findLast((m) => m.author === "agent")?.id ?? null, [messages]);

  // Resposta do funcionário que veio logo depois de cada mensagem do agent (marca a opção escolhida).
  const answers = useMemo(() => {
    const map = new Map<string, string>();
    messages.forEach((message, index) => {
      if (message.author !== "agent") return;
      const reply = messages.slice(index + 1).find((m) => m.author === "employee");
      if (reply) map.set(message.id, reply.content);
    });
    return map;
  }, [messages]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, turn?.reply, turn?.steps.length, turn?.text]);

  const empty = messages.length === 0 && !turn;

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => {
        const el = e.currentTarget;
        stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      }}
      className="min-h-0 flex-1 overflow-y-auto px-4 md:px-8"
    >
      <div className="mx-auto flex min-h-full max-w-[760px] flex-col justify-end gap-5 pt-7 pb-2">
        {empty && (
          <div className="flex flex-col gap-4 pb-6">
            <h1 className="font-display text-[32px] leading-tight tracking-[-0.6px]">Olá, {firstName}. Como posso ajudar?</h1>
            <p className="max-w-[520px] text-[14.5px] text-ink-3">
              Descreva o problema com suas palavras. Eu consulto seus chamados, busco na central de ajuda e chamo um analista
              quando precisar.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((text) => (
                <button
                  key={text}
                  type="button"
                  disabled={!interaction.canInteract}
                  onClick={() => interaction.onSend(text)}
                  className="rounded-lg border border-rule bg-paper px-3 py-[7px] text-[13.5px] font-medium transition-colors enabled:hover:border-primary enabled:hover:bg-primary-soft disabled:opacity-60"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => {
          switch (message.author) {
            case "employee":
              return <EmployeeBubble key={message.id} text={message.content} />;
            case "agent":
              return (
                <AgentMessage
                  key={message.id}
                  message={message}
                  isLast={message.id === lastAgentId}
                  answer={answers.get(message.id) ?? null}
                  tickets={tickets}
                  ticketsLoading={ticketsLoading}
                  interaction={interaction}
                />
              );
            case "analyst":
              return <AnalystMessage key={message.id} message={message} />;
            case "system":
              return <SystemEvent key={message.id} message={message} />;
          }
        })}

        {turn && !turn.userMessage && <EmployeeBubble text={turn.text} pending />}
        {turn && turn.userMessage && <PendingAgentMessage steps={turn.steps} reply={turn.reply} />}
      </div>
    </div>
  );
}