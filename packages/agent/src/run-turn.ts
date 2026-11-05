import type { AgentDecision, AgentStep, Message, MessageAttachment, User } from "@nexo/shared";
import { createNexoAgent } from "./agent";
import { finalizeDecision } from "./decision";
import { buildModelMessages } from "./history";
import { buildInstructions } from "./instructions";
import type { AgentServices, TurnContext } from "./ports";
import { TurnRecorder, type HandoffRequest } from "./recorder";
import { createTools } from "./tools";

export class AgentUnavailableError extends Error {
  constructor(override readonly cause: unknown) {
    super("O assistente não conseguiu responder agora.");
    this.name = "AgentUnavailableError";
  }
}

export interface RunTurnOptions {
  services: AgentServices;
  employee: User;
  conversationId: string;
  history: Message[];
  userMessage: string;
  model: string;
  now?: Date;
  abortSignal?: AbortSignal;
  onStep?: (step: AgentStep) => void;
  onText?: (delta: string) => void;
}

export interface TurnResult {
  text: string;
  attachments: MessageAttachment[];
  decision: AgentDecision;
  handoff: HandoffRequest | null;
  forcedHandoff: boolean;
}

const FORCED_HANDOFF_TEXT = "Vou chamar um analista para te ajudar com isso.";

function fallbackText(recorder: TurnRecorder): string {
  if (recorder.handoff) return "Encaminhei para um analista.";
  if (recorder.attachments.length) return "Confira abaixo.";
  return "Pode me contar um pouco mais?";
}

export async function runAgentTurn(options: RunTurnOptions): Promise<TurnResult> {
  const now = options.now ?? new Date();
  const recorder = new TurnRecorder(options.onStep, now);
  const ctx: TurnContext = {
    services: options.services,
    employee: options.employee,
    conversationId: options.conversationId,
    recorder,
    now,
  };

  const agent = createNexoAgent({
    model: options.model,
    instructions: buildInstructions(options.employee, now),
    tools: createTools(ctx),
  });

  let text = "";
  let streamError: unknown = null;

  try {
    const stream = await agent.stream(buildModelMessages(options.history, options.userMessage), {
      maxSteps: 8,
      abortSignal: options.abortSignal,
      modelSettings: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        timeout: { totalMs: 45_000 },
      },
      onError: ({ error }) => {
        streamError = error;
      },
    });

    for await (const delta of stream.textStream) {
      text += delta;
      options.onText?.(delta);
    }
  } catch (error) {
    throw new AgentUnavailableError(error);
  }

  // Erro do modelo sem nenhum efeito: não há o que salvar como resposta.
  if (streamError && !text.trim() && recorder.steps.length === 0) {
    throw new AgentUnavailableError(streamError);
  }

  if (!text.trim()) {
    text = fallbackText(recorder);
    options.onText?.(text);
  }

  const { decision, forcedHandoff } = finalizeDecision(recorder);
  if (forcedHandoff) {
    const extra = `\n\n${FORCED_HANDOFF_TEXT}`;
    text += extra;
    options.onText?.(extra);
  }

  return {
    text: text.trim(),
    attachments: recorder.attachments,
    decision,
    handoff: recorder.handoff ?? forcedHandoff,
    forcedHandoff: forcedHandoff !== null,
  };
}