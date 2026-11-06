import { createDb } from "../client";
import { isLocalDatabase, loadLocalEnv, requireDatabaseUrl } from "../env";
import { seedDatabase } from "./seed";

loadLocalEnv();

async function main(): Promise<void> {
  const url = requireDatabaseUrl();

  if (!isLocalDatabase(url) && !process.argv.includes("--yes")) {
    console.error("Banco remoto detectado. O seed apaga todos os dados. Rode com --yes para confirmar.");
    process.exit(1);
  }

  const { db, close } = createDb(url, { max: 1 });
  try {
    const result = await seedDatabase(db);
    console.log(`Seed concluído: ${result.users} usuários, ${result.articles} artigos, ${result.tickets} chamados.`);
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error("Falha no seed:", error);
  process.exit(1);
});