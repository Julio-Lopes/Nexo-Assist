import { describe, expect, it } from "vitest";
import { finalizeDecision } from "./decision";
import { TurnRecorder } from "./recorder";

function recorderWith(confidence: number, action: "reply" | "ask_clarification" = "reply") {
  const recorder = new TurnRecorder();
  recorder.declared = {
    intent: "unclear", understanding: "Pedido ambíguo sobre um sistema interno.",
    action, confidence, reason: "Não há regra clara.", rulesApplied: [],
  };
  return recorder;
}

describe("finalizeDecision", () => {
  it("força a transferência quando a confiança fica abaixo do limite", () => {
    const { decision, forcedHandoff } = finalizeDecision(recorderWith(0.41));
    expect(forcedHandoff).toMatchObject({ reason: "low_confidence", level: "N1" });
    expect(decision.action).toBe("handoff");
  });

  it("não transfere quando o agent só está pedindo esclarecimento", () => {
    const { forcedHandoff } = finalizeDecision(recorderWith(0.4, "ask_clarification"));
    expect(forcedHandoff).toBeNull();
  });

  it("a ação efetivamente executada prevalece sobre a declarada", () => {
    const recorder = recorderWith(0.9);
    recorder.perform("propose_draft");
    expect(finalizeDecision(recorder).decision.action).toBe("propose_draft");
  });

  it("infere a decisão quando o modelo não a registrou, sem transferir", () => {
    const recorder = new TurnRecorder();
    recorder.perform("show_ticket");
    const { decision, forcedHandoff } = finalizeDecision(recorder);

    expect(decision.action).toBe("show_ticket");
    expect(decision.rulesApplied.join(" ")).toContain("inferida");
    expect(forcedHandoff).toBeNull();
  });
});