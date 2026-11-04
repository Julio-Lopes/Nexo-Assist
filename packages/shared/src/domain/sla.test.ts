import { describe, expect, it } from "vitest";
import { canReopen } from "./ticket";
import { computeDueAt, isOverdue } from "./sla";

// Datas em UTC. Brasília = UTC-3. 04/11/2026 é quarta-feira.
const utc = (iso: string) => new Date(iso);

describe("computeDueAt", () => {
  it("crítica: 1 hora corrida, mesmo no fim de semana", () => {
    // sábado 11:00 BRT
    expect(computeDueAt("critical", utc("2026-11-07T14:00:00Z")).toISOString())
      .toBe("2026-11-07T15:00:00.000Z");
  });

  it("alta: 4 horas úteis dentro do mesmo dia", () => {
    // quarta 10:00 BRT -> quarta 14:00 BRT
    expect(computeDueAt("high", utc("2026-11-04T13:00:00Z")).toISOString())
      .toBe("2026-11-04T17:00:00.000Z");
  });

  it("alta: passa para o próximo dia útil ao fim do expediente", () => {
    // sexta 16:00 BRT -> 2h na sexta + 2h na segunda -> segunda 10:00 BRT
    expect(computeDueAt("high", utc("2026-11-06T19:00:00Z")).toISOString())
      .toBe("2026-11-09T13:00:00.000Z");
  });

  it("alta: aberto fora do expediente começa a contar na abertura seguinte", () => {
    // quarta 20:00 BRT -> quinta 08:00 + 4h -> quinta 12:00 BRT
    expect(computeDueAt("high", utc("2026-11-04T23:00:00Z")).toISOString())
      .toBe("2026-11-05T15:00:00.000Z");
  });

  it("alta: aberto no sábado conta a partir de segunda 08:00", () => {
    // sábado 11:00 BRT -> segunda 12:00 BRT
    expect(computeDueAt("high", utc("2026-11-07T14:00:00Z")).toISOString())
      .toBe("2026-11-09T15:00:00.000Z");
  });

  it("média: 3 dias úteis pulando o fim de semana", () => {
    // sexta 10:00 BRT -> quarta 10:00 BRT
    expect(computeDueAt("medium", utc("2026-11-06T13:00:00Z")).toISOString())
      .toBe("2026-11-11T13:00:00.000Z");
  });

  it("baixa: 5 dias úteis", () => {
    // quarta 10:00 BRT -> quarta seguinte 10:00 BRT
    expect(computeDueAt("low", utc("2026-11-04T13:00:00Z")).toISOString())
      .toBe("2026-11-11T13:00:00.000Z");
  });
});

describe("isOverdue", () => {
  const now = utc("2026-11-04T13:00:00Z"); // quarta 10:00 BRT

  it("chamado médio parado desde a quinta anterior está vencido", () => {
    expect(
      isOverdue({ priority: "medium", status: "waiting_analyst", lastActivityAt: utc("2026-10-29T13:00:00Z") }, now),
    ).toBe(true);
  });

  it("chamado dentro do prazo não está vencido", () => {
    expect(
      isOverdue({ priority: "medium", status: "in_progress", lastActivityAt: utc("2026-11-03T13:00:00Z") }, now),
    ).toBe(false);
  });

  it("chamado resolvido nunca está vencido", () => {
    expect(
      isOverdue({ priority: "high", status: "resolved", lastActivityAt: utc("2026-10-01T13:00:00Z") }, now),
    ).toBe(false);
  });
});

describe("canReopen", () => {
  const now = utc("2026-11-04T13:00:00Z");

  it("permite reabrir resolvido há 4 dias", () => {
    expect(canReopen(utc("2026-10-31T13:00:00Z"), now)).toBe(true);
  });

  it("não permite reabrir resolvido há mais de 7 dias", () => {
    expect(canReopen(utc("2026-10-20T13:00:00Z"), now)).toBe(false);
  });
});