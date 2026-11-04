import { createDb } from "@nexo/db";
import { TicketNotFoundError, createServices } from "../src";

try {
  process.loadEnvFile("../../.env");
} catch {
  // usa o ambiente
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não definida");

const { db, close } = createDb(url, { max: 1 });
const { tickets, knowledge } = createServices(db, {
  retry: {
    retries: 2,
    baseDelayMs: 100,
    onRetry: ({ method, attempt }) => console.log(`  retry ${attempt} em ${method}`),
  },
});

try {
  console.log("\nChamados abertos da Ana:");
  for (const t of await tickets.listForRequester("emp-ana")) {
    console.log(`  ${t.id} | ${t.status} | vencido: ${t.overdue} | prazo: ${t.dueAt}`);
  }

  console.log("\nAna tentando ver o chamado do Diego:");
  try {
    await tickets.getForRequester("emp-ana", "INC-20390");
    console.log("  ERRO: chamado alheio exposto");
  } catch (error) {
    console.log(`  bloqueado: ${error instanceof TicketNotFoundError}`);
  }

  console.log("\nPossíveis duplicados para 'Notebook muito lento':");
  for (const s of await tickets.findSimilar("emp-ana", { title: "Notebook muito lento", category: "hardware" })) {
    console.log(`  ${s.ticket.id} | score ${s.score.toFixed(2)}`);
  }

  console.log("\nCentral de ajuda para 'vpn erro 809':");
  for (const r of await knowledge.search("vpn erro 809")) {
    console.log(`  ${r.article.id} | score ${r.score} | termos: ${r.matched.join(", ")}`);
  }
} finally {
  await close();
}