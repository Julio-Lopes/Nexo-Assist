import { TICKET_STATUS_LABELS, type TicketView } from "@nexo/shared";
import { cn } from "@/lib/cn";
import { formatDayMonth } from "@/lib/format";
import { CardShell, Dot } from "./card-parts";
import { TICKET_STATUS_DOT } from "./styles";

interface TicketSelectorProps {
  ticketIds: string[];
  tickets: Map<string, TicketView> | undefined;
  answer: string | null;
  disabled: boolean;
  onSelect: (text: string) => void;
}

export function TicketSelector({ ticketIds, tickets, answer, disabled, onSelect }: TicketSelectorProps) {
  return (
    <CardShell>
      <div role="radiogroup" aria-label="Escolha um chamado">
        {ticketIds.map((id, index) => {
          const ticket = tickets?.get(id);
          const label = ticket ? `${id} · ${ticket.title}` : id;
          const selected = answer?.startsWith(id) ?? false;

          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onSelect(label)}
              className={cn(
                "flex min-h-[46px] w-full items-center gap-3.5 px-4 py-2.5 text-left transition-colors",
                index > 0 && "border-t border-rule",
                selected ? "bg-cta/4" : "enabled:hover:bg-desk",
                "disabled:cursor-default",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-4 shrink-0 rounded-full border bg-paper",
                  selected ? "border-[5px] border-cta" : "border-[1.5px] border-ink/20",
                )}
              />
              <span className="font-data text-[12.5px] text-ink-3">{id}</span>
              <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{ticket?.title ?? "Carregando…"}</span>
              {ticket && (
                <>
                  <span className="hidden items-center gap-1.5 text-[12.5px] text-ink-3 sm:flex">
                    <Dot className={TICKET_STATUS_DOT[ticket.status]} />
                    {TICKET_STATUS_LABELS[ticket.status]}
                  </span>
                  <span className="w-11 text-right text-[12.5px] text-ink-3">{formatDayMonth(ticket.createdAt)}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </CardShell>
  );
}