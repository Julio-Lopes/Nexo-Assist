"use client";

import { ArrowRightLeft, ArrowUpRight, Bot, ChevronRight, CircleCheckBig, Clock, Headset, X, type LucideIcon } from "lucide-react";
import { useRef, useState, type RefObject } from "react";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  isOpenStatus,
  type TicketView,
} from "@nexo/shared";
import { Button } from "@/components/ui/button";
import { TICKET_STATUS_DOT, TICKET_STATUS_TEXT } from "@/features/chat/styles";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDayMonth, formatDue, formatTime, timeAgo } from "@/lib/format";

export interface ConversationEvent {
  label: string;
  at: string;
  icon: "transfer" | "headset" | "bot" | "closed";
}

const EVENT_ICONS: Record<ConversationEvent["icon"], LucideIcon> = {
  transfer: ArrowRightLeft,
  headset: Headset,
  bot: Bot,
  closed: CircleCheckBig,
};

function sortTickets(tickets: TicketView[]): TicketView[] {
  return [...tickets].sort(
    (a, b) => Number(isOpenStatus(b.status)) - Number(isOpenStatus(a.status)) || b.updatedAt.localeCompare(a.updatedAt),
  );
}

function ticketMeta(ticket: TicketView): string {
  if (ticket.status === "resolved" && ticket.resolvedAt) return `${ticket.id} · Resolvido em ${formatDayMonth(ticket.resolvedAt)}`;
  return `${ticket.id} · ${TICKET_STATUS_LABELS[ticket.status]}`;
}

function StatusDot({ ticket }: { ticket: TicketView }) {
  return <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", TICKET_STATUS_DOT[ticket.status])} />;
}

/* ---------- linha expansível ---------- */

function TicketRow({ ticket, last }: { ticket: TicketView; last: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <li className={cn(!last && "border-b border-rule")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-3 text-left"
      >
        <StatusDot ticket={ticket} />
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="truncate text-[14.5px] font-medium">{ticket.title}</span>
          <span className="text-[12.5px] text-ink-3">
            {ticketMeta(ticket)}
            {ticket.overdue && <span className="text-warning-text"> · vencido</span>}
          </span>
        </span>
        <ChevronRight aria-hidden className={cn("size-4 shrink-0 text-ink-3 transition-transform", open && "rotate-90")} />
      </button>

      {open && (
        <div className="flex flex-col gap-2.5 pb-3.5 pl-[19px] text-[13px]">
          <p className="leading-normal text-ink-2">{ticket.description}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <dt className="text-[12px] text-ink-3">Prioridade</dt>
              <dd className="font-medium">{PRIORITY_LABELS[ticket.priority]}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-3">Categoria</dt>
              <dd className="font-medium">{CATEGORY_LABELS[ticket.category]}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-3">Atualizado</dt>
              <dd className="font-medium">{timeAgo(ticket.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-ink-3">{ticket.dueAt ? "Próxima resposta" : "Prazo"}</dt>
              <dd className={cn("font-medium", ticket.overdue && "text-warning-text")}>
                {ticket.dueAt ? `até ${formatDue(ticket.dueAt)}` : "Encerrado"}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </li>
  );
}

/* ---------- janela com todos os chamados ---------- */

function AllTicketsDialog({
  dialogRef,
  firstName,
  tickets,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  firstName: string;
  tickets: TicketView[];
}) {
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="all-tickets-title"
      className="m-auto w-[min(820px,calc(100vw-32px))] rounded-2xl bg-paper p-0 text-ink shadow-card backdrop:bg-ink/40"
    >
      <div className="flex items-center gap-2 border-b border-rule py-3 pr-3.5 pl-5">
        <div className="min-w-0 flex-1">
          <h2 id="all-tickets-title" className="text-[15.5px] font-semibold">
            Todos os chamados de {firstName}
          </h2>
          <p className="text-[12.5px] text-ink-3">{tickets.length} no total</p>
        </div>
        <form method="dialog">
          <button type="submit" aria-label="Fechar" className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-desk">
            <X aria-hidden className="size-[18px]" />
          </button>
        </form>
      </div>

      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[640px] text-left text-[13.5px]">
          <thead className="sticky top-0 bg-desk text-[12px] text-ink-3">
            <tr>
              <th scope="col" className="px-5 py-2.5 font-medium">Chamado</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Título</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Prioridade</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Aberto em</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Atualizado</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="border-t border-rule">
                <td className="px-5 py-3 font-data text-[12.5px] text-ink-3">{ticket.id}</td>
                <td className="max-w-[260px] truncate px-3 py-3 font-medium">{ticket.title}</td>
                <td className="px-3 py-3">
                  <span className={cn("flex items-center gap-1.5 whitespace-nowrap", TICKET_STATUS_TEXT[ticket.status])}>
                    <StatusDot ticket={ticket} />
                    {TICKET_STATUS_LABELS[ticket.status]}
                  </span>
                </td>
                <td className="px-3 py-3">{PRIORITY_LABELS[ticket.priority]}</td>
                <td className="px-3 py-3 whitespace-nowrap text-ink-2">{formatDateTime(ticket.createdAt)}</td>
                <td className={cn("px-5 py-3 whitespace-nowrap", ticket.overdue ? "text-warning-text" : "text-ink-2")}>
                  {timeAgo(ticket.updatedAt)}
                  {ticket.overdue && " · vencido"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </dialog>
  );
}

/* ---------- painel ---------- */

interface TicketHistoryProps {
  className?: string;
  firstName: string;
  tickets: TicketView[];
  currentTicketId: string | null;
  lastEvent: ConversationEvent | null;
  onClose: () => void;
}

export function TicketHistory({ className, firstName, tickets, currentTicketId, lastEvent, onClose }: TicketHistoryProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sorted = sortTickets(tickets);
  const current = sorted.find((t) => t.id === currentTicketId) ?? null;
  const others = sorted.filter((t) => t.id !== currentTicketId);
  const open = tickets.filter((t) => isOpenStatus(t.status)).length;
  const EventIcon = lastEvent ? EVENT_ICONS[lastEvent.icon] : Clock;

  return (
    <aside aria-label={`Chamados de ${firstName}`} className={cn("w-[340px] shrink-0 flex-col border-l border-rule bg-paper", className)}>
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-rule pr-3.5 pl-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15.5px] font-semibold">Chamados de {firstName}</h2>
          <p className="text-[12.5px] text-ink-3">
            {open} abertos · {tickets.length - open} encerrados
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar painel" className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-desk">
          <X aria-hidden className="size-[18px]" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-5 pt-6 pb-5">
        {current && (
          <section className="flex flex-col gap-3">
            <h3 className="text-[12.5px] font-semibold text-ink-3">Desta conversa</h3>
            <div className="flex flex-col gap-3.5 rounded-xl bg-desk p-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center">
                  <span className="flex-1 font-data text-[12.5px] font-medium text-ink-3">{current.id}</span>
                  <span className={cn("flex items-center gap-1.5 text-[12.5px] font-semibold", TICKET_STATUS_TEXT[current.status])}>
                    <StatusDot ticket={current} />
                    {TICKET_STATUS_LABELS[current.status]}
                  </span>
                </div>
                <p className="text-[15.5px] leading-[1.3] font-semibold">{current.title}</p>
                <p className="text-[13.5px] text-ink-3">
                  {CATEGORY_LABELS[current.category]} · prioridade {PRIORITY_LABELS[current.priority].toLowerCase()}
                </p>
              </div>

              <div className="flex items-center gap-2 border-t border-rule pt-3">
                <EventIcon aria-hidden className="size-[15px] shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-2">
                  {lastEvent ? lastEvent.label : `Atualizado ${timeAgo(current.updatedAt)}`}
                </span>
                {lastEvent && <span className="text-[12.5px] text-ink-3">{formatTime(lastEvent.at)}</span>}
              </div>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-1">
          <h3 className="text-[12.5px] font-semibold text-ink-3">{current ? "Outros chamados" : "Chamados"}</h3>
          {others.length === 0 ? (
            <p className="py-3 text-[13.5px] text-ink-3">Nenhum outro chamado.</p>
          ) : (
            <ul>
              {others.map((ticket, index) => (
                <TicketRow key={ticket.id} ticket={ticket} last={index === others.length - 1} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="shrink-0 px-4 pt-3 pb-4">
        <Button className="w-full font-medium text-ink-2" onClick={() => dialogRef.current?.showModal()} disabled={tickets.length === 0}>
          Ver todos os chamados de {firstName}
          <ArrowUpRight aria-hidden className="size-3.5 text-ink-3" />
        </Button>
      </div>

      <AllTicketsDialog dialogRef={dialogRef} firstName={firstName} tickets={sorted} />
    </aside>
  );
}