import { PostgresDraftStore, type AgentServices, type DraftStore } from "@nexo/agent";
import { createDb, type Database } from "@nexo/db";
import { createServices, instabilityFromEnv, type KnowledgeService, type TicketService } from "@nexo/tickets";
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

let container: Container | undefined;

/** Criado na primeira requisição e reaproveitado enquanto a instância (ou function) estiver quente. */
export function getContainer(): Container {
  if (container) return container;

  const env = loadEnv();
  // Em serverless cada instância tem seu pool: mantém 1 conexão para não esgotar o Postgres.
  const { db } = createDb(env.DATABASE_URL, { max: env.VERCEL ? 1 : 5 });
  const services = createServices(db, {
    instability: instabilityFromEnv(),
    retry: {
      retries: 2,
      baseDelayMs: 250,
      onRetry: ({ method, attempt }) => console.warn(`[tickets] retry ${attempt} em ${method}`),
    },
  });

  const conversations = new ConversationService(db);
  const drafts = new SyncedDraftStore(new PostgresDraftStore(db), conversations);
  const agentServices: AgentServices = { tickets: services.tickets, knowledge: services.knowledge, drafts };

  if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.warn("[api] GOOGLE_GENERATIVE_AI_API_KEY ausente: o agent vai responder como indisponível.");
  }

  container = {
    env,
    db,
    ...services,
    conversations,
    drafts,
    chat: new ChatService(conversations, agentServices, env.LLM_MODEL),
  };
  return container;
}