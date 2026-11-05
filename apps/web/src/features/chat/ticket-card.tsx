import { CATEGORY_LABELS, TICKET_STATUS_LABELS, type TicketView } from "@nexo/shared";
import { formatDateTime, timeAgo } from "@/lib/format";
import { CardShell, Dot, Field, PriorityValue } from "./card-parts";
import { TICKET_STATUS_DOT, TICKET_STATUS_TEXT } from "./styles";

export function TicketCard({ ticketId, ticket, loading }: { ticketId: string; ticket?: TicketView; loading: boolean }) {
  if (!ticket) {
    return (
      <CardShell className="px-[18px] py-4 text-[13.5px] text-ink-3">
        {loading ? "Carregando chamado…" : `Não foi possível carregar o ${ticketId}.`}
      </CardShell>
    );
  }

  return (
    <CardShell>
      <div className="flex flex-col gap-1.5 px-[18px] pt-4 pb-3.5">
        <div className="flex items-center gap-2 pb-0.5 text-[12.5px] text-ink-3">
          <span className="font-medium">Chamado</span>
          <Dot className="size-[3px] bg-rule" />
          <span className="font-data">{ticket.id}</span>
          <span className="flex-1" />
          <span className={`flex items-center gap-1.5 font-medium ${TICKET_STATUS_TEXT[ticket.status]}`}>
            <Dot className={TICKET_STATUS_DOT[ticket.status]} />
            {TICKET_STATUS_LABELS[ticket.status]}
          </span>
        </div>
        <h3 className="text-[18px] leading-tight font-semibold tracking-[-0.2px]">{ticket.title}</h3>
        <p className="text-[13.5px] leading-normal text-ink-2">{ticket.description}</p>
      </div>

      <div className="px-[18px] pb-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-rule pt-3 sm:grid-cols-4">
          <Field label="Categoria">{CATEGORY_LABELS[ticket.category]}</Field>
          <Field label="Prioridade">
            <PriorityValue priority={ticket.priority} />
          </Field>
          <Field label="Aberto em">{formatDateTime(ticket.createdAt)}</Field>
          <Field label="Última atualização">
            <span className={ticket.overdue ? "text-warning-text" : undefined}>{timeAgo(ticket.updatedAt)}</span>
            {ticket.overdue && <span className="text-[13.5px] font-normal text-ink-3">· prazo vencido</span>}
          </Field>
        </dl>
      </div>
    </CardShell>
  );
}