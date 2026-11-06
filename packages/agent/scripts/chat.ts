import { randomUUID } from "node:crypto";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { conversations, createDb, eq, users } from "@nexo/db";
import type { AgentDecision, Message, MessageAttachment, MessageAuthor, User } from "@nexo/shared";
import { createServices, instabilityFromEnv } from "@nexo/tickets";
import { PostgresDraftStore, runAgentTurn } from "../src";

try {
  process.loadEnvFile("../../.env");
} catch {
  // usa o ambiente
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não definida");

const email = process.argv[2] ?? "ana.souza@nexo.com.br";
const model = process.env.LLM_MODEL ?? "gemini-3.1-flash-lite";
const { db, close } = createDb(databaseUrl, { max: 2 });

const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
if (!row || row.role !== "employee") throw new Error(`Funcionário ${email} não encontrado`);

const employee: User = {
  id: row.id, name: row.name, email: row.email, role: row.role,
  department: row.department, device: row.device, supportLevel: row.supportLevel,
};

const [conversation] = await db.insert(conversations).values({ employeeId: employee.id }).returning();
if (!conversation) throw new Error("Falha ao criar conversa");

const services = { ...createServices(db, { instability: instabilityFromEnv() }), drafts: new PostgresDraftStore(db) };
const history: Message[] = [];

const message = (
  author: MessageAuthor,
  content: string,
  attachments: MessageAttachment[] = [],
  decision: AgentDecision | null = null,
): Message => ({
  id: randomUUID(), conversationId: conversation.id, author, authorName: null,
  content, attachments, decision, createdAt: new Date().toISOString(),
});

const rl = createInterface({ input: stdin, output: stdout });
console.log(`Conversando como ${employee.name} (${model}). Digite "sair" para encerrar.`);

try {
  for (;;) {
    const text = (await rl.question("\nvocê > ")).trim();
    if (!text || text === "sair") break;

    stdout.write("nexo > ");
    const result = await runAgentTurn({
      services, employee, conversationId: conversation.id, history, userMessage: text, model,
      onStep: (s) => console.log(`\n  · ${s.label} [${s.status}, ${s.durationMs} ms] ${s.summary}`),
      onText: (delta) => stdout.write(delta),
    });

    const { steps: _steps, ...decision } = result.decision;
    console.log(`\n  cards: ${result.attachments.map((a) => (a.kind === "draft" ? `draft ${a.draftId}` : a.kind)).join(", ") || "nenhum"}`);
    console.log(`  decisão: ${JSON.stringify(decision)}`);

    history.push(message("employee", text), message("agent", result.text, result.attachments, result.decision));

    if (result.handoff) {
      console.log(`  >> transferido (${result.handoff.reason}, Suporte ${result.handoff.level}). O agent para aqui.`);
      break;
    }
  }
} finally {
  rl.close();
  await close();
}