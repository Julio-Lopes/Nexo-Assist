import type { Affected, Priority, TicketType } from "./ticket";

export interface PriorityInput {
  type: TicketType;
  affected: Affected;
  /** Parou ou impede de trabalhar (sem alternativa). */
  blocking: boolean;
  /** Há um compromisso no mesmo dia em risco. */
  deadlineToday: boolean;
}

export interface PriorityResult {
  priority: Priority;
  reason: string;
}

/**
 * Anexo A: prioridade = impacto (quantas pessoas) + urgência (compromisso em risco).
 * Fica em código para ser determinística e explicável; o LLM só extrai os sinais.
 */
export function derivePriority(input: PriorityInput): PriorityResult {
  const { type, affected, blocking, deadlineToday } = input;

  if (blocking && affected !== "self") {
    const who = affected === "team" ? "uma equipe" : "a empresa";
    return { priority: "critical", reason: `Algo está parado para ${who}.` };
  }

  if (deadlineToday) {
    return { priority: "high", reason: "Há um compromisso hoje que depende disso." };
  }

  if (blocking) {
    return { priority: "high", reason: "Impede você de trabalhar." };
  }

  if (type === "REQ") {
    return { priority: "low", reason: "Pedido sem urgência." };
  }

  return { priority: "medium", reason: "Atrapalha, mas há alternativa." };
}