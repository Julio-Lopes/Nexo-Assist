import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDatabase, type TestDatabase } from "@nexo/db/testing";
import type { TicketDraft } from "@nexo/shared";
import { InvalidTicketStateError, TicketNotFoundError, TicketValidationError } from "./errors";
import { PostgresTicketService } from "./ticket-service";

let tdb: TestDatabase;
let service: PostgresTicketService;

const ana = { id: "emp-ana", name: "Ana Souza" };

const vpnDraft: TicketDraft = {
  type: "INC",
  title: "VPN não conecta no notebook",
  description: "Erro 809 ao conectar na VPN no Windows 11 desde ontem.",
  category: "network_vpn",
  priority: "high",
  affected: "self",
};

beforeAll(async () => {
  tdb = await setupTestDatabase("nexo_test_tickets");
  service = new PostgresTicketService(tdb.db);
});

beforeEach(async () => {
  await tdb.reset();
});

afterAll(async () => {
  await tdb.close();
});

describe("privacidade", () => {
  it("lista apenas os chamados do próprio solicitante", async () => {
    const list = await service.listForRequester(ana.id, { includeClosed: true });

    expect(list.length).toBe(5);
    expect(list.every((t) => t.requesterId === ana.id)).toBe(true);
    expect(list.map((t) => t.id)).not.toContain("INC-20390");
  });

  it("trata o chamado de outra pessoa como inexistente", async () => {
    await expect(service.getForRequester(ana.id, "INC-20390")).rejects.toBeInstanceOf(TicketNotFoundError);
  });

  it("não deixa comentar nem transferir chamado alheio", async () => {
    await expect(service.addComment(ana.id, "INC-20390", "Alguma informação", ana)).rejects.toBeInstanceOf(TicketNotFoundError);
    await expect(
      service.transfer(ana.id, "INC-20390", { level: "N2", summary: "Resumo do caso", actor: ana }),
    ).rejects.toBeInstanceOf(TicketNotFoundError);
  });
});

describe("prazos", () => {
  it("marca como vencido o chamado médio parado há 6 dias", async () => {
    const ticket = await service.getForRequester(ana.id, "INC-20311");
    expect(ticket.overdue).toBe(true);
    expect(ticket.dueAt).not.toBeNull();
  });

  it("comentar reinicia o prazo e registra o evento", async () => {
    const updated = await service.addComment(ana.id, "INC-20311", "Continua lento mesmo depois de reiniciar.", ana);
    const events = await service.listEvents(ana.id, "INC-20311");

    expect(updated.overdue).toBe(false);
    expect(events.at(-1)).toMatchObject({ kind: "comment", authorName: "Ana Souza" });
  });
});

describe("duplicidade", () => {
  it("encontra o chamado aberto parecido", async () => {
    const similar = await service.findSimilar(ana.id, { title: "Notebook muito lento", category: "hardware" });
    expect(similar[0]?.ticket.id).toBe("INC-20311");
    expect(similar[0]?.score).toBeGreaterThanOrEqual(0.5);
  });

  it("não sugere chamados de outras pessoas", async () => {
    const similar = await service.findSimilar(ana.id, { title: "VPN cai a cada 10 minutos", category: "network_vpn" });
    expect(similar).toHaveLength(0);
  });
});

describe("criação", () => {
  it("gera números sequenciais por tipo", async () => {
    const inc = await service.create(ana.id, vpnDraft, { actor: ana });
    const req = await service.create(ana.id, { ...vpnDraft, type: "REQ", title: "Acesso ao Power BI", category: "access" }, { actor: ana });

    expect(inc.id).toBe("INC-20520");
    expect(req.id).toBe("REQ-10460");
  });

  it("é idempotente pelo rascunho de origem", async () => {
    const first = await service.create(ana.id, vpnDraft, { actor: ana, sourceDraftId: "D-900" });
    const second = await service.create(ana.id, vpnDraft, { actor: ana, sourceDraftId: "D-900" });
    const list = await service.listForRequester(ana.id, { includeClosed: true });

    expect(second.id).toBe(first.id);
    expect(list).toHaveLength(6);
  });

  it("recusa rascunho incompleto", async () => {
    await expect(service.create(ana.id, { ...vpnDraft, title: "oi" }, { actor: ana })).rejects.toBeInstanceOf(TicketValidationError);
  });
});

describe("reabertura", () => {
  it("reabre um chamado resolvido há 4 dias", async () => {
    const reopened = await service.reopen(ana.id, "INC-20150", "A senha bloqueou de novo.", ana);
    expect(reopened.status).toBe("waiting_analyst");
    expect(reopened.resolvedAt).toBeNull();
  });

  it("recusa reabrir um chamado resolvido há mais de 7 dias", async () => {
    await expect(service.reopen(ana.id, "INC-19877", "Voltou a acontecer.", ana)).rejects.toBeInstanceOf(InvalidTicketStateError);
  });

  it("não aceita comentário em chamado resolvido", async () => {
    await expect(service.addComment(ana.id, "INC-20150", "Mais informação", ana)).rejects.toBeInstanceOf(InvalidTicketStateError);
  });
});