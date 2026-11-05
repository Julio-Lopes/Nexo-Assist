import type {
  AgentAction,
  AgentIntent,
  AgentStep,
  HandoffReason,
  MessageAttachment,
  SupportLevel,
} from "@nexo/shared";

export interface DeclaredDecision {
  intent: AgentIntent;
  understanding: string;
  action: AgentAction;
  confidence: number;
  reason: string;
  rulesApplied: string[];
}

export interface HandoffRequest {
  reason: HandoffReason;
  summary: string;
  ticketId: string | null;
  level: SupportLevel;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Erro desconhecido");

/**
 * Registro de tudo o que aconteceu num turno: passos, cards, ações efetivas,
 * decisão declarada pelo modelo e pedido de transferência.
 */
export class TurnRecorder {
  readonly startedAt: Date;
  readonly steps: AgentStep[] = [];
  readonly attachments: MessageAttachment[] = [];
  readonly performed: AgentAction[] = [];
  declared: DeclaredDecision | null = null;
  handoff: HandoffRequest | null = null;

  constructor(
    private readonly onStep?: (step: AgentStep) => void,
    now: Date = new Date(),
  ) {
    this.startedAt = now;
  }

  /** Executa uma operação externa registrando duração, status e resumo. */
  async track<T>(tool: string, label: string, run: () => Promise<T>, summarize: (result: T) => string): Promise<T> {
    const started = Date.now();
    try {
      const result = await run();
      this.push({ tool, label, status: "success", durationMs: Date.now() - started, summary: summarize(result) });
      return result;
    } catch (error) {
      this.push({ tool, label, status: "error", durationMs: Date.now() - started, summary: errorMessage(error) });
      throw error;
    }
  }

  /** Passo calculado em código, sem chamada externa (ex.: prioridade, prazo). */
  note(step: Omit<AgentStep, "durationMs">): void {
    this.push({ ...step, durationMs: 0 });
  }

  attach(attachment: MessageAttachment): void {
    this.attachments.push(attachment);
  }

  perform(action: AgentAction): void {
    this.performed.push(action);
  }

  private push(step: AgentStep): void {
    this.steps.push(step);
    this.onStep?.(step);
  }
}