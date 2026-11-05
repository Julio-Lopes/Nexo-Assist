import { createDb, type Database } from "@nexo/db";
import { createServices, instabilityFromEnv, type KnowledgeService, type TicketService } from "@nexo/tickets";
import { ConversationService } from "./conversations/conversation-service";
import { loadEnv, type Env } from "./env";

export interface Container {
  env: Env;
  db: Database;
  tickets: TicketService;
  knowledge: KnowledgeService;
  conversations: ConversationService;
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

  container = { env, db, ...services, conversations: new ConversationService(db) };
  return container;
}