import {
  AFFECTED_LABELS,
  CATEGORY_LABELS,
  TICKET_TYPE_LABELS,
  type MessageAttachment,
} from "@nexo/shared";
import { Button } from "@/components/ui/button";
import { formatDue } from "@/lib/format";
import { CardShell, Dot, Field, PriorityValue } from "./card-parts";

type DraftAttachment = Extract<MessageAttachment, { kind: "draft" }>;

const STATE_STYLE = {
  pending: { label: "Aguardando confirmação", text: "text-warning-text", dot: "bg-warning" },
  confirmed: { label: "Confirmado", text: "text-success-text", dot: "bg-success" },
  cancelled: { label: "Descartado", text: "text-ink-3", dot: "bg-ink/30" },
} as const;

function heading(draft: DraftAttachment): string {
  switch (draft.mode) {
    case "create":
      return `Novo chamado · ${TICKET_TYPE_LABELS[draft.draft.type]}`;
    case "update":
      return `Atualização do ${draft.targetTicketId ?? "chamado"}`;
    case "reopen":
      return `Reabertura do ${draft.targetTicketId ?? "chamado"}`;
  }
}

interface DraftCardProps {
  attachment: DraftAttachment;
  canInteract: boolean;
  busy: "confirm" | "cancel" | null;
  shortcut: string;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit: () => void;
}

export function DraftCard({ attachment, canInteract, busy, shortcut, onConfirm, onCancel, onEdit }: DraftCardProps) {
  const { draft } = attachment;
  const state = STATE_STYLE[attachment.state];
  const pending = attachment.state === "pending";

  return (
    <CardShell className={pending ? undefined : "opacity-90"}>
      <div className="flex flex-col gap-1.5 px-[18px] pt-4 pb-3.5">
        <div className="flex flex-wrap items-center gap-2 pb-0.5 text-[12.5px] text-ink-3">
          <span className="font-medium">{heading(attachment)}</span>
          <Dot className="size-[3px] bg-rule" />
          <span>Rascunho {attachment.draftId}</span>
          <span className="flex-1" />
          <span className={`flex items-center gap-1.5 font-medium ${state.text}`}>
            <Dot className={state.dot} />
            {state.label}
          </span>
        </div>
        <h3 className="text-[18px] leading-tight font-semibold tracking-[-0.2px]">{draft.title}</h3>
        {attachment.mode === "create" ? (
          <p className="text-[13.5px] leading-normal text-ink-2">{draft.description}</p>
        ) : (
          <div className="mt-1 rounded-lg bg-desk px-3 py-2 text-[13.5px] leading-normal">
            <p className="text-[12.5px] text-ink-3">
              {attachment.mode === "update" ? "Vai ser acrescentado ao chamado" : "Motivo da reabertura"}
            </p>
            <p className="text-ink-2">{attachment.note}</p>
          </div>
        )}
      </div>

      <div className="px-[18px] pb-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-rule pt-3 sm:grid-cols-3">
          <Field label="Categoria">{CATEGORY_LABELS[draft.category]}</Field>
          <Field label="Prioridade">
            <PriorityValue priority={draft.priority} />
            <span className="text-[13.5px] font-normal text-ink-3">· resposta até {formatDue(attachment.dueAt)}</span>
          </Field>
          <Field label="Afetados">{AFFECTED_LABELS[draft.affected]}</Field>
        </dl>
      </div>

      {pending && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-rule bg-desk py-2 pr-3.5 pl-2">
          <Button variant="primary" onClick={onConfirm} loading={busy === "confirm"} disabled={!canInteract || busy !== null}>
            Confirmar
            <kbd className="rounded-md bg-white/15 px-1.5 py-px font-ui text-[11.5px] font-normal text-white/80">{shortcut}</kbd>
          </Button>
          <Button onClick={onEdit} disabled={!canInteract || busy !== null}>
            Editar
          </Button>
          <Button variant="ghost" onClick={onCancel} loading={busy === "cancel"} disabled={!canInteract || busy !== null}>
            Cancelar
          </Button>
        </div>
      )}
    </CardShell>
  );
}