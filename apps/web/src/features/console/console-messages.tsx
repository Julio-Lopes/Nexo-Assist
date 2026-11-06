"use client";

import { ArrowRightLeft, CheckCheck, ChevronDown, Headset } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import type { Message, MessageAttachment } from "@nexo/shared";
import { DecisionDetails } from "@/features/chat/decision-details";
import { cn } from "@/lib/cn";
import { formatRelativeDay, formatTime } from "@/lib/format";

const DRAFT_STATE: Record<"pending" | "confirmed" | "cancelled", string> = {
  pending: "aguardando confirmação",
  confirmed: "confirmado",
  cancelled: "descartado",
};

/** Versão compacta dos cards que o funcionário viu. */
function describeAttachment(attachment: MessageAttachment): string {
  switch (attachment.kind) {
    case "ticket":
      return `Card do ${attachment.ticketId}`;
    case "ticket_selector":
      return `Seletor: ${attachment.ticketIds.join(", ")}`;
    case "draft":
      return `Rascunho ${attachment.draftId} · ${DRAFT_STATE[attachment.state]}`;
    case "options":
      return `Opções: ${attachment.options.map((o) => o.label).join(" · ")}`;
  }
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Destaca os trechos que casam com a busca. */
function Highlight({ text, term }: { text: string; term: string }) {
  const query = term.trim();
  if (!query) return <>{text}</>;

  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark key={index} className="rounded-sm bg-warning/35 px-0.5 text-ink">
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function Meta({ time, read = false }: { time: string; read?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-[3px] self-end pb-px text-[11px] text-ink-3">
      {formatTime(time)}
      {read && <CheckCheck aria-hidden className="size-3.5 text-primary" />}
    </span>
  );
}

function SenderTag({ name, tag, tagClass }: { name: string; tag: string; tagClass: string }) {
  return (
    <p className="flex items-center gap-1.5 px-1 text-[12px]">
      <span className="font-semibold text-ink-2">{name}</span>
      <span className={cn("rounded-md px-1.5 py-px text-[11px] font-semibold", tagClass)}>{tag}</span>
    </p>
  );
}

function ClientMessage({ message, grouped, highlight }: { message: Message; grouped: boolean; highlight: string }) {
  return (
    <div className={cn("flex", grouped ? "pt-[3px]" : "pt-4")}>
      <div
        className={cn(
          "flex max-w-[70%] items-end gap-2.5 bg-paper px-3 pt-2 pb-1.5 shadow-[0_1px_2px_#1b243112]",
          grouped ? "rounded-xl" : "rounded-[4px_12px_12px_12px]",
        )}
      >
        <p className="text-[14.5px] leading-[1.45] whitespace-pre-wrap">
          <Highlight text={message.content} term={highlight} />
        </p>
        <Meta time={message.createdAt} />
      </div>
    </div>
  );
}

function AgentMessage({ message, highlight }: { message: Message; highlight: string }) {
  const [open, setOpen] = useState(false);
  const decision = message.decision;

  return (
    <div className="flex flex-col items-end gap-1 pt-4">
      <SenderTag name="Nexo Assist" tag="IA" tagClass="bg-primary-soft text-primary-text" />
      <div className="flex max-w-[70%] flex-col gap-1.5 rounded-[12px_4px_12px_12px] bg-[#E6EFFA] px-3 pt-2 pb-1.5 shadow-[0_1px_2px_#1b243112]">
        <p className="text-[14.5px] leading-[1.45] whitespace-pre-wrap">
          <Highlight text={message.content} term={highlight} />
        </p>
        {message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.attachments.map((attachment, index) => (
              <span key={index} className="rounded-md bg-paper/70 px-1.5 py-0.5 text-[12px] text-ink-2">
                {describeAttachment(attachment)}
              </span>
            ))}
          </div>
        )}
        <Meta time={message.createdAt} read />
      </div>
      {decision && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1 px-1 text-[12px] text-ink-3 hover:text-primary-text"
        >
          Confiança {Math.round(decision.confidence * 100)}% · {open ? "ocultar decisão" : "ver decisão"}
          <ChevronDown aria-hidden className={cn("size-3 transition-transform", open && "rotate-180")} />
        </button>
      )}
      {open && decision && <DecisionDetails decision={decision} />}
    </div>
  );
}

function AnalystMessage({ message, highlight }: { message: Message; highlight: string }) {
  return (
    <div className="flex flex-col items-end gap-1 pt-4">
      <SenderTag name={message.authorName ?? "Analista"} tag="Suporte" tagClass="bg-success-soft text-success-text" />
      <div className="flex max-w-[70%] items-end gap-2.5 rounded-[12px_4px_12px_12px] bg-[#E3F4EA] px-3 pt-2 pb-1.5 shadow-[0_1px_2px_#1b243112]">
        <p className="text-[14.5px] leading-[1.45] whitespace-pre-wrap">
          <Highlight text={message.content} term={highlight} />
        </p>
        <Meta time={message.createdAt} read />
      </div>
    </div>
  );
}

function SystemMessage({ message }: { message: Message }) {
  const Icon = message.content.includes("assumiu") ? Headset : ArrowRightLeft;
  return (
    <div className="flex items-center gap-3 pt-[18px] pb-1">
      <span className="h-px flex-1 bg-ink/8" />
      <span className="flex items-center gap-1.5 text-center text-[12px] font-medium text-ink-3">
        <Icon aria-hidden className="size-[13px]" />
        {message.content} · {formatTime(message.createdAt)}
      </span>
      <span className="h-px flex-1 bg-ink/8" />
    </div>
  );
}

export function ConsoleMessages({ messages, highlight = "" }: { messages: Message[]; highlight?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const count = messages.length;

  useEffect(() => {
    const el = scrollRef.current;
    if (el && !highlight.trim()) el.scrollTop = el.scrollHeight;
  }, [count, highlight]);

  // Ao buscar, leva até o primeiro trecho encontrado.
  useEffect(() => {
    if (!highlight.trim()) return;
    scrollRef.current?.querySelector("mark")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlight]);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-4 md:px-10">
      <div className="flex min-h-full flex-col justify-end">
        {messages.length === 0 && <p className="py-10 text-center text-[13.5px] text-ink-3">Nenhuma mensagem ainda.</p>}

        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const day = formatRelativeDay(message.createdAt);
          const newDay = !previous || formatRelativeDay(previous.createdAt) !== day;
          const grouped = previous?.author === message.author && !newDay;

          return (
            <Fragment key={message.id}>
              {newDay && (
                <div className="flex justify-center pt-3 pb-1">
                  <span className="rounded-full bg-paper/80 px-2.5 py-1 text-[12px] font-medium text-ink-3">{day}</span>
                </div>
              )}
              {message.author === "employee" && <ClientMessage message={message} grouped={grouped} highlight={highlight} />}
              {message.author === "agent" && <AgentMessage message={message} highlight={highlight} />}
              {message.author === "analyst" && <AnalystMessage message={message} highlight={highlight} />}
              {message.author === "system" && <SystemMessage message={message} />}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}