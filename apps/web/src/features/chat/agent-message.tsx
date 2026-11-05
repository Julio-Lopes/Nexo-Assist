"use client";

import { Check, ChevronDown, CircleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { AgentStep, Message, MessageAttachment, TicketView } from "@nexo/shared";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { DecisionDetails } from "./decision-details";
import { DraftCard } from "./draft-card";
import { QuickOptions } from "./quick-options";
import { TicketCard } from "./ticket-card";
import { TicketSelector } from "./ticket-selector";

export interface Interaction {
  canInteract: boolean;
  busyAction: string | null;
  shortcut: string;
  onSend: (text: string) => void;
  onSystemOption: (id: string) => void;
  onConfirmDraft: (draftId: string) => void;
  onCancelDraft: (draftId: string) => void;
  onEditDraft: () => void;
}

/** Um rótulo por passo, na ordem; com erro se alguma ocorrência falhou. */
function stepLabels(steps: AgentStep[]) {
  const labels = new Map<string, boolean>();
  for (const step of steps) labels.set(step.label, (labels.get(step.label) ?? false) || step.status === "error");
  return [...labels.entries()].map(([label, failed]) => ({ label, failed }));
}

function StatusLine({ steps, trailing }: { steps: AgentStep[]; trailing?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
      <span className="font-semibold text-ink">Nexo Assist</span>
      {stepLabels(steps).map(({ label, failed }) => (
        <span key={label} className={cn("flex items-center gap-[5px]", failed ? "text-danger-text" : "text-ink-3")}>
          {failed ? <CircleAlert aria-hidden className="size-3" /> : <Check aria-hidden className="size-3" />}
          {label}
        </span>
      ))}
      {trailing}
    </div>
  );
}

function Bubble({ children }: { children: ReactNode }) {
  return (
    <div className="w-fit max-w-[600px] rounded-[4px_12px_12px_12px] border border-rule bg-paper px-4 py-3 text-[14.5px] leading-normal whitespace-pre-wrap">
      {children}
    </div>
  );
}

interface AgentMessageProps {
  message: Message;
  isLast: boolean;
  answer: string | null;
  tickets: Map<string, TicketView> | undefined;
  ticketsLoading: boolean;
  interaction: Interaction;
}

export function AgentMessage({ message, isLast, answer, tickets, ticketsLoading, interaction }: AgentMessageProps) {
  const [open, setOpen] = useState(false);
  const decision = message.decision;
  const interactive = interaction.canInteract && isLast;

  function renderAttachment(attachment: MessageAttachment, index: number) {
    switch (attachment.kind) {
      case "ticket":
        return (
          <TicketCard
            key={index}
            ticketId={attachment.ticketId}
            ticket={tickets?.get(attachment.ticketId)}
            loading={ticketsLoading}
          />
        );
      case "ticket_selector":
        return (
          <TicketSelector
            key={index}
            ticketIds={attachment.ticketIds}
            tickets={tickets}
            answer={answer}
            disabled={!interactive}
            onSelect={interaction.onSend}
          />
        );
      case "draft": {
        const busy = interaction.busyAction?.endsWith(`:${attachment.draftId}`)
          ? (interaction.busyAction.split(":")[0] as "confirm" | "cancel")
          : null;
        return (
          <DraftCard
            key={index}
            attachment={attachment}
            canInteract={interaction.canInteract}
            busy={busy}
            shortcut={interaction.shortcut}
            onConfirm={() => interaction.onConfirmDraft(attachment.draftId)}
            onCancel={() => interaction.onCancelDraft(attachment.draftId)}
            onEdit={interaction.onEditDraft}
          />
        );
      }
      case "options":
        return (
          <QuickOptions
            key={index}
            question={attachment.question}
            options={attachment.options}
            answer={answer}
            disabled={!interactive}
            onSend={interaction.onSend}
            onSystemOption={interaction.onSystemOption}
          />
        );
    }
  }

  return (
    <article className="flex flex-col gap-1.5">
      <StatusLine
        steps={decision?.steps ?? []}
        trailing={
          decision && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="ml-auto flex items-center gap-1 font-medium text-primary-text hover:underline"
            >
              {open ? "Ocultar decisão" : "Ver decisão"}
              <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", open && "rotate-180")} />
            </button>
          )
        }
      />
      {open && decision && <DecisionDetails decision={decision} />}
      {message.content && <Bubble>{message.content}</Bubble>}
      {message.attachments.map(renderAttachment)}
    </article>
  );
}

/** Resposta em andamento: passos ao vivo e texto em streaming. */
export function PendingAgentMessage({ steps, reply }: { steps: AgentStep[]; reply: string }) {
  return (
    <article className="flex flex-col gap-1.5" aria-live="polite" aria-busy="true">
      <StatusLine
        steps={steps}
        trailing={
          !reply && (
            <span className="flex items-center gap-1.5 text-ink-3">
              <Spinner className="size-3" />
              pensando
            </span>
          )
        }
      />
      {reply && (
        <Bubble>
          {reply}
          <span aria-hidden className="ml-0.5 inline-block h-4 w-[2px] translate-y-[3px] animate-pulse bg-ink-3" />
        </Bubble>
      )}
    </article>
  );
}