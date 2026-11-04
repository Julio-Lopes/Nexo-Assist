import { createDb } from "../client";
import { isLocalDatabase, loadLocalEnv, requireDatabaseUrl } from "../env";
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

loadLocalEnv();

async function main(): Promise<void> {
  const url = requireDatabaseUrl();

  if (!isLocalDatabase(url) && !process.argv.includes("--yes")) {
    console.error("Banco remoto detectado. O seed apaga todos os dados. Rode com --yes para confirmar.");
    process.exit(1);
  }

  const { db, close } = createDb(url, { max: 1 });
  const seed = buildSeed(new Date());

  try {
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

    console.log(
      `Seed concluído: ${seed.users.length} usuários, ${seed.articles.length} artigos, ${seed.tickets.length} chamados.`,
    );
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error("Falha no seed:", error);
  process.exit(1);
});