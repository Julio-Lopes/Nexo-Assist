import { describe, expect, it, vi } from "vitest";
import type { User } from "@nexo/shared";
import { TicketSystemUnavailableError, type TicketService, type TicketView } from "@nexo/tickets";
import { confirmDraft, correctHandoffReason, handoffToAnalyst, proposeTicketDraft } from "./handlers";
import type { DraftRecord, DraftStore, NewDraft, TurnContext } from "./ports";
import { TurnRecorder } from "./recorder";

const now = new Date("2026-11-05T13:00:00Z");

const employee: User = {
  id: "emp-ana", name: "Ana Souza", email: "ana.souza@nexo.com.br", role: "employee",
  department: "Financeiro", device: "Windows 11", supportLevel: null,
};

function ticket(overrides: Partial<TicketView> = {}): TicketView {
  return {
    id: "INC-20311", type: "INC", title: "Notebook lento após atualização do Windows",
    description: "Lentidão geral desde a atualização.", category: "hardware", priority: "medium",
    affected: "self", status: "waiting_analyst", requesterId: "emp-ana",
    createdAt: now.toISOString(), updatedAt: now.toISOString(), resolvedAt: null,
    dueAt: now.toISOString(), overdue: false, slaLabel: "3 dias úteis", reopenable: false,
    ...overrides,
  };
}

function draftRecord(overrides: Partial<DraftRecord> = {}): DraftRecord {
  return {
    id: "D-381", conversationId: "c1", employeeId: "emp-ana", mode: "create", targetTicketId: null,
    payload: {
      type: "INC", title: "Rede da equipe fora do ar", description: "Ninguém da equipe acessa a rede desde 9h.",
      category: "network_vpn", priority: "critical", affected: "team",
    },
    note: null, state: "pending", createdAt: new Date(now.getTime() - 60_000),
    ...overrides,
  };
}

function setup(tickets: Partial<TicketService> = {}, drafts: Partial<DraftStore> = {}) {
  const recorder = new TurnRecorder(undefined, now);
  const create = vi.fn(async (input: NewDraft): Promise<DraftRecord> => ({ ...input, id: "D-400", state: "pending", createdAt: now }));
  const ctx: TurnContext = {
    employee, conversationId: "c1", now, recorder,
    services: {
      tickets: { findSimilar: vi.fn().mockResolvedValue([]), ...tickets } as unknown as TicketService,
      knowledge: { search: vi.fn().mockResolvedValue([]) },
      drafts: {
        create,
        findPending: vi.fn().mockResolvedValue(null),
        markDecided: vi.fn().mockResolvedValue(undefined),
        ...drafts,
      },
    },
  };
  return { ctx, recorder, create };
}

const vpnDraft = {
  type: "INC" as const, category: "network_vpn" as const,
  title: "VPN não conecta no notebook, erro 809",
  description: "Desde ontem a VPN mostra o erro 809 no Windows 11.",
  affected: "self" as const, blocking: false, deadlineToday: true, notDuplicateOf: [],
};

describe("propose_ticket_draft", () => {
  it("calcula a prioridade em código e monta um rascunho pendente", async () => {
    const { ctx, recorder } = setup();
    const result = await proposeTicketDraft(ctx, vpnDraft);

    expect(result.ok).toBe(true);
    expect(recorder.attachments[0]).toMatchObject({ kind: "draft", state: "pending", draft: { priority: "high" } });
    expect(recorder.steps.map((s) => s.label)).toEqual([
      "verificou chamados parecidos", "classificou a prioridade", "consultou o SLA", "montou o rascunho",
    ]);
  });

  it("não cria rascunho quando há um provável duplicado", async () => {
    const { ctx, recorder, create } = setup({
      findSimilar: vi.fn().mockResolvedValue([{ ticket: ticket({ category: "network_vpn" }), score: 0.8 }]),
    });
    const result = await proposeTicketDraft(ctx, vpnDraft);

    expect(result.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(recorder.attachments).toHaveLength(0);
  });

  it("aceita criar quando o funcionário disse que é outro problema", async () => {
    const { ctx } = setup({
      findSimilar: vi.fn().mockResolvedValue([{ ticket: ticket(), score: 0.8 }]),
    });
    const result = await proposeTicketDraft(ctx, { ...vpnDraft, notDuplicateOf: ["INC-20311"] });
    expect(result.ok).toBe(true);
  });
});

describe("confirm_draft", () => {
  it("recusa um rascunho criado no mesmo turno", async () => {
    const createTicket = vi.fn();
    const { ctx } = setup(
      { create: createTicket },
      { findPending: vi.fn().mockResolvedValue(draftRecord({ createdAt: now })) },
    );

    const result = await confirmDraft(ctx, { draftId: "D-381" });

    expect(result.ok).toBe(false);
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("aplica um rascunho já conferido e pede transferência em caso crítico", async () => {
    const markDecided = vi.fn().mockResolvedValue(undefined);
    const { ctx, recorder } = setup(
      { create: vi.fn().mockResolvedValue(ticket({ id: "INC-20520", priority: "critical", status: "open" })) },
      { findPending: vi.fn().mockResolvedValue(draftRecord()), markDecided },
    );

    const result = await confirmDraft(ctx, { draftId: "D-381" });

    expect(result).toMatchObject({ ok: true, requiresHandoff: true });
    expect(markDecided).toHaveBeenCalledWith("D-381", "confirmed");
    expect(recorder.performed).toContain("create_ticket");
  });
});

describe("handoff_to_analyst", () => {
  it("transfere a conversa mesmo se o sistema legado falhar, com N2 para vencido", async () => {
    const { ctx, recorder } = setup({
      getForRequester: vi.fn().mockResolvedValue(ticket({ overdue: true })),
      transfer: vi.fn().mockRejectedValue(new TicketSystemUnavailableError()),
    });

    const result = await handoffToAnalyst(ctx, { reason: "overdue", summary: "Chamado parado há 6 dias.", ticketId: "INC-20311" });

    expect(result.ok).toBe(true);
    expect(recorder.handoff).toMatchObject({ level: "N2", ticketId: "INC-20311" });
    expect(recorder.steps.find((s) => s.tool === "transfer_ticket")?.status).toBe("error");
  });
});

describe("correctHandoffReason", () => {
  it("troca crítico por vencido quando o chamado só está vencido", () => {
    expect(correctHandoffReason("critical", ticket({ overdue: true })).reason).toBe("overdue");
  });

  it("usa crítico quando o chamado tem prioridade crítica", () => {
    expect(correctHandoffReason("employee_request", ticket({ priority: "critical" })).reason).toBe("critical");
  });

  it("não aceita vencido para chamado dentro do prazo", () => {
    expect(correctHandoffReason("overdue", ticket()).reason).toBe("employee_request");
  });

  it("mantém o motivo quando não há chamado", () => {
    expect(correctHandoffReason("critical", null)).toEqual({ reason: "critical", note: null });
  });
});