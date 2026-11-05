import { describe, expect, it } from "vitest";
import { InvalidTransitionError, agentCanReply, nextStatus } from "./state";

describe("máquina de estados da conversa", () => {
  it("agent transfere: vai para aguardando atendente", () => {
    expect(nextStatus("with_agent", "handoff")).toBe("waiting_human");
  });

  it("analista assume uma conversa aguardando", () => {
    expect(nextStatus("waiting_human", "take")).toBe("with_human");
  });

  it("analista pode assumir proativamente uma conversa com o agent", () => {
    expect(nextStatus("with_agent", "take")).toBe("with_human");
  });

  it("não deixa assumir uma conversa que já está com um analista", () => {
    expect(() => nextStatus("with_human", "take")).toThrow(InvalidTransitionError);
  });

  it("devolver ao agent reativa o atendimento automático", () => {
    expect(nextStatus("with_human", "release")).toBe("with_agent");
  });

  it("não transfere de novo uma conversa que já espera atendente", () => {
    expect(() => nextStatus("waiting_human", "handoff")).toThrow(InvalidTransitionError);
  });

  it("conversa encerrada não muda mais de estado", () => {
    expect(() => nextStatus("closed", "close")).toThrow(InvalidTransitionError);
    expect(() => nextStatus("closed", "release")).toThrow(InvalidTransitionError);
  });

  it("agent só responde quando a conversa está com ele", () => {
    expect(agentCanReply("with_agent")).toBe(true);
    expect(agentCanReply("waiting_human")).toBe(false);
    expect(agentCanReply("with_human")).toBe(false);
    expect(agentCanReply("closed")).toBe(false);
  });
});