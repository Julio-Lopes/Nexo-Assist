import type { AgentAction, DraftMode, User } from "@nexo/shared";
import type { Actor, TicketView } from "@nexo/tickets";
import type { DraftRecord, TurnContext } from "./ports";

export const actorFor = (employee: User): Actor => ({
  id: employee.id,
  name: `${employee.name} (via Nexo Assist)`,
});

const ACTION_BY_MODE: Record<DraftMode, AgentAction> = {
  create: "create_ticket",
  update: "update_ticket",
  reopen: "reopen_ticket",
};

const LABEL_BY_MODE: Record<DraftMode, string> = {
  create: "criou o chamado",
  update: "atualizou o chamado",
  reopen: "reabriu o chamado",
};

function requireTarget(draft: DraftRecord): string {
  if (!draft.targetTicketId) throw new Error(`Rascunho ${draft.id} sem chamado de destino.`);
  return draft.targetTicketId;
}

export interface DraftOutcome {
  ticket: TicketView;
  /** Anexo A: caso crítico vai para um analista. */
  requiresHandoff: boolean;
}

/** Aplica um rascunho confirmado. Usado pela ferramenta e pelo botão Confirmar da API. */
export async function executeDraft(ctx: TurnContext, draft: DraftRecord): Promise<DraftOutcome> {
  const { tickets, drafts } = ctx.services;
  const actor = actorFor(ctx.employee);
  const employeeId = ctx.employee.id;

  const ticket = await ctx.recorder.track(
    `${draft.mode}_ticket`,
    LABEL_BY_MODE[draft.mode],
    () => {
      switch (draft.mode) {
        case "create":
          return tickets.create(employeeId, draft.payload, { actor, sourceDraftId: draft.id });
        case "update":
          return tickets.addComment(employeeId, requireTarget(draft), draft.note ?? "", actor);
        case "reopen":
          return tickets.reopen(employeeId, requireTarget(draft), draft.note ?? "", actor);
      }
    },
    (t) => t.id,
  );

  await drafts.markDecided(draft.id, "confirmed");
  ctx.recorder.attach({ kind: "ticket", ticketId: ticket.id });
  ctx.recorder.perform(ACTION_BY_MODE[draft.mode]);

  return { ticket, requiresHandoff: draft.mode === "create" && ticket.priority === "critical" };
}