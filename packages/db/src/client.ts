import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export interface CreateDbOptions {
  /** Em serverless (Vercel), mantenha baixo: cada instância abre seu próprio pool. */
  max?: number;
}

export function createDb(url: string, options: CreateDbOptions = {}) {
  const client = postgres(url, {
    max: options.max ?? 5,
    idle_timeout: 20,
    connect_timeout: 10,
    // compatível com pgbouncer em modo transaction, caso seja usado na frente do Postgres
    prepare: false,
  });

  const db = drizzle(client, { schema });

  return { db, close: () => client.end() };
}

export type Database = ReturnType<typeof createDb>["db"];