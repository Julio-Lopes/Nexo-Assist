import type { Database } from "../client";
import {
  conversations,
  kbArticles,
  messages,
  sessions,
  ticketDrafts,
  ticketEvents,
  tickets,
  users,
} from "../schema";
import { buildSeed } from "./data";

/** Apaga tudo e recria os dados de demonstração, com datas relativas a "now". */
export async function seedDatabase(db: Database, now: Date = new Date()) {
  const seed = buildSeed(now);

  await db.transaction(async (tx) => {
    // ordem inversa das dependências
    await tx.delete(messages);
    await tx.delete(ticketDrafts);
    await tx.delete(conversations);
    await tx.delete(ticketEvents);
    await tx.delete(tickets);
    await tx.delete(sessions);
    await tx.delete(kbArticles);
    await tx.delete(users);

    await tx.insert(users).values(seed.users);
    await tx.insert(kbArticles).values(seed.articles);
    await tx.insert(tickets).values(seed.tickets);
    await tx.insert(ticketEvents).values(seed.events);
  });

  return { users: seed.users.length, articles: seed.articles.length, tickets: seed.tickets.length };
}