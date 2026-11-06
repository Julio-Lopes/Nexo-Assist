import { count } from "drizzle-orm";
import { createDb } from "./client";
import { loadLocalEnv, requireDatabaseUrl } from "./env";
import { runMigrations } from "./migrations";
import { users } from "./schema";
import { seedDatabase } from "./seed/seed";

loadLocalEnv();

/** Roda no boot do container: migrations sempre; seed só se o banco estiver vazio e SEED_IF_EMPTY=true. */
async function main(): Promise<void> {
  const { db, close } = createDb(requireDatabaseUrl(), { max: 1 });

  try {
    await runMigrations(db);
    console.log("[bootstrap] migrations aplicadas");

    if (process.env.SEED_IF_EMPTY === "true") {
      const [row] = await db.select({ value: count() }).from(users);
      if ((row?.value ?? 0) === 0) {
        const result = await seedDatabase(db);
        console.log(`[bootstrap] banco vazio: seed com ${result.users} usuários e ${result.tickets} chamados`);
      }
    }
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error("[bootstrap] falhou:", error);
  process.exit(1);
});