import { PostgresDraftStore, type AgentServices, type DraftStore } from "@nexo/agent";
import { createDb, type Database } from "@nexo/db";
import {
  createServices,
  instabilityFromEnv,
  type InstabilityOptions,
  type KnowledgeService,
  type TicketService,
} from "@nexo/tickets";
import { ChatService } from "./chat/chat-service";
import { SyncedDraftStore } from "./chat/synced-draft-store";
import { ConversationService } from "./conversations/conversation-service";
import { loadEnv, type Env } from "./env";

export interface Container {
  env: Env;
  db: Database;
  tickets: TicketService;
  knowledge: KnowledgeService;
  conversations: ConversationService;
  drafts: DraftStore;
  chat: ChatService;
}

export interface ContainerOverrides {
  db?: Database;
  /** null desliga a simulação de instabilidade (testes). */
  instability?: InstabilityOptions | null;
}

export function buildContainer(env: Env, overrides: ContainerOverrides = {}): Container {
  // Em serverless cada instância tem seu pool: mantém 1 conexão para não esgotar o Postgres.
  const db = overrides.db ?? createDb(env.DATABASE_URL, { max: env.VERCEL ? 1 : 5 }).db;

  const services = createServices(db, {
    instability: overrides.instability === undefined ? instabilityFromEnv() : overrides.instability,
    retry: {
      retries: 2,
      baseDelayMs: 250,
      onRetry: ({ method, attempt }) => console.warn(`[tickets] retry ${attempt} em ${method}`),
    },
  });

  const conversations = new ConversationService(db);
  const drafts = new SyncedDraftStore(new PostgresDraftStore(db), conversations);
  const agentServices: AgentServices = { tickets: services.tickets, knowledge: services.knowledge, drafts };

  if (!env.GOOGLE_GENERATIVE_AI_API_KEY && env.NODE_ENV !== "test") {
    console.warn("[api] GOOGLE_GENERATIVE_AI_API_KEY ausente: o agent vai responder como indisponível.");
  }

  return {
    env,
    db,
    ...services,
    conversations,
    drafts,
    chat: new ChatService(conversations, agentServices, env.LLM_MODEL),
  };
}

let container: Container | undefined;

/** Criado na primeira requisição e reaproveitado enquanto a instância (ou function) estiver quente. */
export function getContainer(): Container {
  container ??= buildContainer(loadEnv());
  return container;
}