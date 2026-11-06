import { sql } from "drizzle-orm";
import { createDb, type Database } from "./client";
import { runMigrations } from "./migrations";
import { kbArticles, ticketEvents, tickets, users } from "./schema";
import { buildSeed } from "./seed/data";

export function testDatabaseUrl(name: string): string {
  const base = process.env.TEST_DATABASE_BASE_URL ?? "postgres://nexo:nexo@localhost:5432";
  return `${base.replace(/\/$/, "")}/${name}`;
}

export interface TestDatabase {
  db: Database;
  url: string;
  /** Zera tabelas e sequências e aplica o seed com datas relativas a "now". */
  reset: (now?: Date) => Promise<void>;
  close: () => Promise<void>;
}

export async function setupTestDatabase(name: string): Promise<TestDatabase> {
  const url = testDatabaseUrl(name);
  const { db, close } = createDb(url, { max: 3 });
  await runMigrations(db);

  const reset = async (now: Date = new Date()) => {
    await db.execute(
      sql`truncate table messages, ticket_drafts, conversations, ticket_events, tickets, sessions, kb_articles, users restart identity cascade`,
    );
    await db.execute(sql`alter sequence inc_number_seq restart with 20520`);
    await db.execute(sql`alter sequence req_number_seq restart with 10460`);
    await db.execute(sql`alter sequence draft_number_seq restart with 381`);

    const seed = buildSeed(now);
    await db.insert(users).values(seed.users);
    await db.insert(kbArticles).values(seed.articles);
    await db.insert(tickets).values(seed.tickets);
    await db.insert(ticketEvents).values(seed.events);
  };

  return { db, url, reset, close };
}