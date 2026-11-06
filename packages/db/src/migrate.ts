import { createDb } from "./client";
import { loadLocalEnv, requireDatabaseUrl } from "./env";
import { runMigrations } from "./migrations";

loadLocalEnv();

async function main(): Promise<void> {
  const { db, close } = createDb(requireDatabaseUrl(), { max: 1 });
  try {
    await runMigrations(db);
    console.log("Migrations aplicadas.");
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error("Falha ao aplicar migrations:", error);
  process.exit(1);
});