import { Agent } from "@mastra/core/agent";
import type { createTools } from "./tools";

/** "gemini-3.1-flash-lite" vira "google/gemini-3.1-flash-lite" no roteador de modelos do Mastra. */
export function resolveModel(model: string): string {
  return model.includes("/") ? model : `google/${model}`;
}

export interface NexoAgentConfig {
  model: string;
  instructions: string;
  tools: ReturnType<typeof createTools>;
}

/** Criado por turno: instruções e ferramentas carregam o funcionário e o registro daquele turno. */
export function createNexoAgent(config: NexoAgentConfig): Agent {
  return new Agent({
    id: "nexo-assist",
    name: "Nexo Assist",
    instructions: config.instructions,
    model: resolveModel(config.model),
    tools: config.tools,
  });
}