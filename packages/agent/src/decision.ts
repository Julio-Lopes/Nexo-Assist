import {
  CONFIDENCE_HANDOFF_THRESHOLD,
  type AgentAction,
  type AgentDecision,
} from "@nexo/shared";
import type { DeclaredDecision, HandoffRequest, TurnRecorder } from "./recorder";

/** Ações com efeito real têm precedência sobre a ação que o modelo declarou. */
const PRECEDENCE: AgentAction[] = [
  "handoff",
  "create_ticket",
  "update_ticket",
  "reopen_ticket",
  "propose_draft",
  "show_ticket",
  "ask_selection",
];

const FALLBACK: DeclaredDecision = {
  intent: "unclear",
  understanding: "O modelo não registrou o que entendeu.",
  action: "reply",
  confidence: CONFIDENCE_HANDOFF_THRESHOLD,
  reason: "Decisão inferida pelas ferramentas executadas no turno.",
  rulesApplied: [],
};

export interface FinalDecision {
  decision: AgentDecision;
  forcedHandoff: HandoffRequest | null;
}

export function finalizeDecision(recorder: TurnRecorder): FinalDecision {
  const declared = recorder.declared ?? FALLBACK;
  const performed = PRECEDENCE.find((action) => recorder.performed.includes(action));
  const action = performed ?? declared.action;
  const confidence = Math.min(1, Math.max(0, declared.confidence));
  const rulesApplied = [...declared.rulesApplied];

  if (!recorder.declared) {
    rulesApplied.push("Decisão inferida pelo sistema: o modelo não a registrou");
  }

  // Anexo A: transferir quando o agent não tem segurança. Perguntar para esclarecer é aceitável.
  const mustHandOff =
    !recorder.handoff && confidence < CONFIDENCE_HANDOFF_THRESHOLD && action !== "ask_clarification";

  const forcedHandoff: HandoffRequest | null = mustHandOff
    ? { reason: "low_confidence", summary: declared.understanding, ticketId: null, level: "N1" }
    : null;

  if (forcedHandoff) {
    rulesApplied.push("Transferência: confiança abaixo do limite");
  }

  return {
    forcedHandoff,
    decision: {
      intent: declared.intent,
      understanding: declared.understanding,
      action: forcedHandoff ? "handoff" : action,
      confidence,
      reason: declared.reason,
      rulesApplied,
      steps: recorder.steps,
    },
  };
}