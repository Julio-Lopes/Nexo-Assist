import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client";
import { loadLocalEnv, requireDatabaseUrl } from "./env";

loadLocalEnv();

async function main(): Promise<void> {
  const { db, close } = createDb(requireDatabaseUrl(), { max: 1 });
  try {
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("Migrations aplicadas.");
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error("Falha ao aplicar migrations:", error);
  process.exit(1);
});