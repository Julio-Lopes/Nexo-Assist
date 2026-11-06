import {
  HANDOFF_REASON_LABELS,
  PRIORITY_LABELS,
  SLA_RULES,
  TICKET_STATUS_LABELS,
  computeDueAt,
  derivePriority,
  isOpenStatus,
  ticketDraftSchema,
  type Affected,
  type AgentAction,
  type AgentIntent,
  type Category,
  type HandoffReason,
  type SupportLevel,
  type TicketDraft,
  type TicketType,
} from "@nexo/shared";
import { SIMILARITY_LIKELY_DUPLICATE, TicketError, type TicketView } from "@nexo/tickets";
import { actorFor, executeDraft } from "./drafts";
import { describeTicket, formatDateTime, timeAgo } from "./format";
import type { TurnContext } from "./ports";

export interface ToolFailure {
  ok: false;
  error: string;
  retryable: boolean;
}

const reject = (error: string): ToolFailure => ({ ok: false, error, retryable: false });

/** Erros viram dados para o modelo: ele explica ao funcionário em vez de quebrar o turno. */
function failure(error: unknown): ToolFailure {
  if (error instanceof TicketError) {
    return { ok: false, error: error.message, retryable: error.code === "unavailable" };
  }
  console.error("[agent] falha em ferramenta", error);
  return reject("Falha inesperada ao executar a ação.");
}

function slaSummary(ticket: TicketView, now: Date): string {
  if (!ticket.dueAt) return "chamado encerrado, sem prazo em aberto";
  if (ticket.overdue) {
    return `vencido: sem atualização ${timeAgo(new Date(ticket.updatedAt), now)}, prazo de ${ticket.slaLabel}`;
  }
  return `próxima resposta até ${formatDateTime(new Date(ticket.dueAt))}`;
}

/* ---------- consulta ---------- */

export async function listMyTickets(ctx: TurnContext, input: { includeClosed: boolean }) {
  try {
    const list = await ctx.recorder.track(
      "list_my_tickets",
      "consultou seus chamados",
      () => ctx.services.tickets.listForRequester(ctx.employee.id, { includeClosed: input.includeClosed }),
      (l) => (l.length === 0 ? "nenhum chamado encontrado" : `${l.length} chamado(s): ${l.map((t) => t.id).join(", ")}`),
    );
    return { ok: true as const, tickets: list.map((t) => describeTicket(t, ctx.now)) };
  } catch (error) {
    return failure(error);
  }
}

export async function getTicket(ctx: TurnContext, input: { ticketId: string }) {
  try {
    const id = input.ticketId.trim().toUpperCase();
    const [ticket, events] = await ctx.recorder.track(
      "get_ticket",
      `consultou o ${id}`,
      () =>
        Promise.all([
          ctx.services.tickets.getForRequester(ctx.employee.id, id),
          ctx.services.tickets.listEvents(ctx.employee.id, id),
        ]),
      ([t]) => TICKET_STATUS_LABELS[t.status],
    );

    ctx.recorder.note({ tool: "compute_sla", label: "calculou o prazo", status: "success", summary: slaSummary(ticket, ctx.now) });
    ctx.recorder.attach({ kind: "ticket", ticketId: ticket.id });
    ctx.recorder.perform("show_ticket");

    return {
      ok: true as const,
      ticket: describeTicket(ticket, ctx.now),
      recentEvents: events.slice(-3).map((e) => ({
        author: e.authorName,
        text: e.body,
        when: timeAgo(new Date(e.createdAt), ctx.now),
      })),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function askTicketSelection(ctx: TurnContext, input: { ticketIds: string[] }) {
  try {
    const owned = await ctx.services.tickets.listForRequester(ctx.employee.id, { includeClosed: true });
    const ownedIds = new Set(owned.map((t) => t.id));
    // privacidade: ids que não são do funcionário são descartados
    const ids = [...new Set(input.ticketIds.map((id) => id.trim().toUpperCase()))].filter((id) => ownedIds.has(id));

    if (ids.length < 2) return reject("Informe ao menos dois chamados do próprio funcionário.");

    ctx.recorder.attach({ kind: "ticket_selector", ticketIds: ids });
    ctx.recorder.perform("ask_selection");
    return { ok: true as const, shown: ids, instruction: "Escreva só a pergunta; o card já lista os chamados." };
  } catch (error) {
    return failure(error);
  }
}

export async function searchHelpCenter(ctx: TurnContext, input: { query: string }) {
  try {
    const results = await ctx.recorder.track(
      "search_help_center",
      "buscou na central de ajuda",
      () => ctx.services.knowledge.search(input.query, 3),
      (r) => (r.length === 0 ? "nenhum artigo relevante" : r.map((x) => x.article.id).join(", ")),
    );
    return {
      ok: true as const,
      articles: results.map((r) => ({
        id: r.article.id,
        title: r.article.title,
        body: r.article.body,
        matchedTerms: r.matched,
      })),
    };
  } catch (error) {
    return failure(error);
  }
}

/* ---------- rascunhos ---------- */

export interface DraftInput {
  type: TicketType;
  category: Category;
  title: string;
  description: string;
  affected: Affected;
  blocking: boolean;
  deadlineToday: boolean;
  notDuplicateOf: string[];
}

export async function proposeTicketDraft(ctx: TurnContext, input: DraftInput) {
  try {
    const { tickets, drafts } = ctx.services;

    const similar = await ctx.recorder.track(
      "find_similar",
      "verificou chamados parecidos",
      () => tickets.findSimilar(ctx.employee.id, { title: input.title }),
      (list) => (list.length === 0 ? "nenhum parecido" : list.map((s) => `${s.ticket.id} (${s.score.toFixed(2)})`).join(", ")),
    );

    // Anexo A: sem duplicidade. A checagem é em código, antes de qualquer rascunho.
    const duplicate = similar.find(
      (s) => s.score >= SIMILARITY_LIKELY_DUPLICATE && !input.notDuplicateOf.includes(s.ticket.id),
    );
    if (duplicate) {
      return {
        ...reject(
          "Já existe um chamado parecido. Pergunte se é o mesmo problema: se for, use propose_ticket_change; se não for, chame de novo com notDuplicateOf.",
        ),
        similarTicket: describeTicket(duplicate.ticket, ctx.now),
      };
    }

    const { priority, reason } = derivePriority(input);
    ctx.recorder.note({
      tool: "derive_priority",
      label: "classificou a prioridade",
      status: "success",
      summary: `${PRIORITY_LABELS[priority]}: ${reason}`,
    });

    const dueAt = computeDueAt(priority, ctx.now);
    ctx.recorder.note({
      tool: "compute_sla",
      label: "consultou o SLA",
      status: "success",
      summary: `${SLA_RULES[priority].label}, resposta até ${formatDateTime(dueAt)}`,
    });

    const parsed = ticketDraftSchema.safeParse({
      type: input.type,
      category: input.category,
      title: input.title.trim(),
      description: input.description.trim(),
      priority,
      affected: input.affected,
    });
    if (!parsed.success) {
      return reject("Título precisa ter de 5 a 120 caracteres e a descrição pelo menos 10. Complete as informações.");
    }
    const payload: TicketDraft = parsed.data;

    const draft = await ctx.recorder.track(
      "create_draft",
      "montou o rascunho",
      () =>
        drafts.create({
          conversationId: ctx.conversationId,
          employeeId: ctx.employee.id,
          mode: "create",
          targetTicketId: null,
          payload,
          note: null,
        }),
      (d) => `rascunho ${d.id}`,
    );

    ctx.recorder.attach({
      kind: "draft",
      draftId: draft.id,
      mode: "create",
      targetTicketId: null,
      draft: payload,
      note: null,
      dueAt: dueAt.toISOString(),
      state: "pending",
    });
    ctx.recorder.perform("propose_draft");

    return {
      ok: true as const,
      draftId: draft.id,
      priority: PRIORITY_LABELS[priority],
      priorityReason: reason,
      responseDue: formatDateTime(dueAt),
      instruction:
        "Explique a prioridade em uma frase e peça para conferir o rascunho abaixo. Não diga que o chamado foi criado e não cite o número do rascunho.",
    };
  } catch (error) {
    return failure(error);
  }
}

export interface ChangeInput {
  ticketId: string;
  mode: "update" | "reopen";
  note: string;
}

export async function proposeTicketChange(ctx: TurnContext, input: ChangeInput) {
  try {
    const id = input.ticketId.trim().toUpperCase();
    const ticket = await ctx.recorder.track(
      "get_ticket",
      `consultou o ${id}`,
      () => ctx.services.tickets.getForRequester(ctx.employee.id, id),
      (t) => TICKET_STATUS_LABELS[t.status],
    );

    const open = isOpenStatus(ticket.status);
    if (input.mode === "update" && !open) {
      return reject(
        ticket.reopenable
          ? "Chamado resolvido: proponha reabrir (mode reopen)."
          : "Chamado encerrado há mais de 7 dias: proponha um chamado novo.",
      );
    }
    if (input.mode === "reopen" && !ticket.reopenable) {
      return reject(open ? "O chamado ainda está aberto: use mode update." : "Resolvido há mais de 7 dias: proponha um chamado novo.");
    }
    if (input.note.trim().length < 3) return reject("Escreva o que será acrescentado ao chamado.");

    const payload: TicketDraft = {
      type: ticket.type,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      affected: ticket.affected,
    };
    const dueAt = computeDueAt(ticket.priority, ctx.now);

    const draft = await ctx.recorder.track(
      "create_draft",
      input.mode === "update" ? "montou a atualização" : "montou a reabertura",
      () =>
        ctx.services.drafts.create({
          conversationId: ctx.conversationId,
          employeeId: ctx.employee.id,
          mode: input.mode,
          targetTicketId: ticket.id,
          payload,
          note: input.note.trim(),
        }),
      (d) => `rascunho ${d.id}`,
    );

    ctx.recorder.attach({
      kind: "draft",
      draftId: draft.id,
      mode: input.mode,
      targetTicketId: ticket.id,
      draft: payload,
      note: input.note.trim(),
      dueAt: dueAt.toISOString(),
      state: "pending",
    });
    ctx.recorder.perform("propose_draft");

    return {
      ok: true as const,
      draftId: draft.id,
      instruction: "Peça para conferir abaixo antes de aplicar. Não cite o número do rascunho.",
    };
  } catch (error) {
    return failure(error);
  }
}

export async function confirmDraft(ctx: TurnContext, input: { draftId: string }) {
  try {
    const draft = await ctx.services.drafts.findPending(ctx.conversationId, input.draftId.trim().toUpperCase());
    if (!draft) return reject("Rascunho não encontrado ou já decidido.");

    // Anexo A: o funcionário precisa ter visto o rascunho num turno anterior.
    if (draft.createdAt.getTime() >= ctx.recorder.startedAt.getTime()) {
      return reject("O funcionário ainda não conferiu este rascunho. Peça a confirmação antes.");
    }

    const outcome = await executeDraft(ctx, draft);
    return {
      ok: true as const,
      ticket: describeTicket(outcome.ticket, ctx.now),
      requiresHandoff: outcome.requiresHandoff,
      instruction: outcome.requiresHandoff
        ? "Chamado crítico: chame handoff_to_analyst com reason critical e o id do chamado."
        : "Em uma frase, informe o número do chamado e o prazo (ticket.nextResponseDue). Não diga que alguém foi avisado ou já está cuidando do caso.",
    };
  } catch (error) {
    return failure(error);
  }
}

/* ---------- interação e transferência ---------- */

export function offerOptions(ctx: TurnContext, input: { question: string | null; options: string[] }) {
  const options = input.options.map((o) => o.trim()).filter(Boolean).slice(0, 4);
  if (options.length < 2) return reject("Ofereça de 2 a 4 opções.");

  ctx.recorder.attach({
    kind: "options",
    question: input.question?.trim() || null,
    options: options.map((label, index) => ({ id: `opt-${index + 1}`, label })),
  });
  return { ok: true as const, instruction: "Não repita as opções no texto." };
}

export interface HandoffInput {
  reason: HandoffReason;
  summary: string;
  ticketId: string | null;
}

/**
 * O modelo escolhe o motivo, mas ele precisa bater com o chamado:
 * só é "crítico" se a prioridade for crítica, e só é "vencido" se o prazo passou.
 */
export function correctHandoffReason(
  reason: HandoffReason,
  ticket: TicketView | null,
): { reason: HandoffReason; note: string | null } {
  if (!ticket) return { reason, note: null };

  if (ticket.priority === "critical") {
    return reason === "critical" ? { reason, note: null } : { reason: "critical", note: `${ticket.id} tem prioridade crítica` };
  }
  if (reason === "critical") {
    return ticket.overdue
      ? { reason: "overdue", note: `${ticket.id} não é crítico, mas está vencido` }
      : { reason: "employee_request", note: `${ticket.id} não é crítico` };
  }
  if (reason === "overdue" && !ticket.overdue) {
    return { reason: "employee_request", note: `${ticket.id} está dentro do prazo` };
  }
  return { reason, note: null };
}

export async function handoffToAnalyst(ctx: TurnContext, input: HandoffInput) {
  if (ctx.recorder.handoff) return reject("A transferência já foi registrada neste turno.");

  const ticketId = input.ticketId?.trim().toUpperCase() || null;

  // Lê o chamado antes de transferir: depois da transferência o prazo reinicia e "vencido" some.
  let ticket: TicketView | null = null;
  if (ticketId) {
    try {
      ticket = await ctx.services.tickets.getForRequester(ctx.employee.id, ticketId);
    } catch {
      // sem os dados do chamado, mantém o motivo informado
    }
  }

  const corrected = correctHandoffReason(input.reason, ticket);
  if (corrected.note) {
    ctx.recorder.note({
      tool: "check_handoff_reason",
      label: "conferiu o motivo da transferência",
      status: "success",
      summary: `${HANDOFF_REASON_LABELS[input.reason]} → ${HANDOFF_REASON_LABELS[corrected.reason]}: ${corrected.note}`,
    });
  }

  const reason = corrected.reason;
  const level: SupportLevel = reason === "critical" || reason === "overdue" ? "N2" : "N1";
  let responseDue: string | null = null;

  if (ticketId) {
    try {
      const transferred = await ctx.recorder.track(
        "transfer_ticket",
        `transferiu o ${ticketId}`,
        () => ctx.services.tickets.transfer(ctx.employee.id, ticketId, { level, summary: input.summary, actor: actorFor(ctx.employee) }),
        () => `Suporte ${level}`,
      );
      responseDue = transferred.dueAt ? formatDateTime(new Date(transferred.dueAt)) : null;
    } catch {
      // A conversa vai para o analista mesmo se o sistema legado falhar; o passo fica registrado como erro.
    }
  }

  ctx.recorder.handoff = { reason, summary: input.summary.trim(), ticketId, level };
  ctx.recorder.note({
    tool: "handoff",
    label: "chamou um analista",
    status: "success",
    summary: `Suporte ${level} · ${HANDOFF_REASON_LABELS[reason]}`,
  });
  ctx.recorder.perform("handoff");

  return {
    ok: true as const,
    level: `Suporte ${level}`,
    responseDue,
    instruction: "Diga para quem encaminhou e quando deve haver resposta, sem prometer mais nada. Depois disso você não responde mais nesta conversa.",
  };
}

export interface DecisionInput {
  intent: AgentIntent;
  understanding: string;
  action: AgentAction;
  confidence: number;
  reason: string;
  rulesApplied: string[];
}

export function recordDecision(ctx: TurnContext, input: DecisionInput) {
  ctx.recorder.declared = { ...input, confidence: Math.min(1, Math.max(0, input.confidence)) };
  return { ok: true as const };
}