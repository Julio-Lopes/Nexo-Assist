import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { conversations, eq, users } from "@nexo/db";
import { setupTestDatabase } from "@nexo/db/testing";
import type { AgentDecision, Message, MessageAttachment, MessageAuthor, User } from "@nexo/shared";
import { createServices } from "@nexo/tickets";
import { AgentUnavailableError, PostgresDraftStore, runAgentTurn, type TurnResult } from "../src";
import { GLOBAL_CHECKS, type CheckResult } from "./checks";
import { SCENARIOS, type Scenario } from "./scenarios";

try {
  process.loadEnvFile("../../.env");
} catch {
  // usa o ambiente
}

const MODEL = process.env.LLM_MODEL ?? "gemini-3.1-flash-lite";
/** Pausa entre turnos para caber no limite de requisições por minuto do free tier. */
const DELAY_MS = Number(process.env.EVAL_DELAY_MS ?? 20_000);
const RETRY_WAIT_MS = 60_000;
const filter = process.argv[2];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface TurnReport {
  user: string;
  reply: string;
  latencyMs: number;
  decision: AgentDecision | null;
  checks: CheckResult[];
  unavailable: string | null;
}

interface ScenarioReport {
  scenario: Scenario;
  turns: TurnReport[];
}

function message(
  conversationId: string,
  author: MessageAuthor,
  content: string,
  attachments: MessageAttachment[] = [],
  decision: AgentDecision | null = null,
): Message {
  return {
    id: randomUUID(),
    conversationId,
    author,
    authorName: null,
    content,
    attachments,
    decision,
    createdAt: new Date().toISOString(),
  };
}

const tdb = await setupTestDatabase("nexo_eval");
const scenarios = filter ? SCENARIOS.filter((s) => s.id === filter) : SCENARIOS;
const reports: ScenarioReport[] = [];

console.log(`Avaliando ${scenarios.length} cenário(s) com ${MODEL}. Pausa de ${DELAY_MS / 1000}s entre turnos.\n`);

try {
  for (const scenario of scenarios) {
    await tdb.reset();
    const services = { ...createServices(tdb.db, { instability: null }), drafts: new PostgresDraftStore(tdb.db) };

    const [row] = await tdb.db.select().from(users).where(eq(users.email, scenario.employeeEmail)).limit(1);
    if (!row) throw new Error(`Funcionário ${scenario.employeeEmail} não está no seed`);

    const employee: User = {
      id: row.id, name: row.name, email: row.email, role: row.role,
      department: row.department, device: row.device, supportLevel: row.supportLevel,
    };

    const [conversation] = await tdb.db.insert(conversations).values({ employeeId: employee.id }).returning();
    if (!conversation) throw new Error("Falha ao criar conversa");

    const history: Message[] = [];
    const report: ScenarioReport = { scenario, turns: [] };
    console.log(`> ${scenario.id}: ${scenario.title}`);

    for (const turn of scenario.turns) {
      const started = Date.now();
      let result: TurnResult | null = null;
      let unavailable: string | null = null;

      for (let attempt = 1; attempt <= 2 && !result; attempt++) {
        try {
          result = await runAgentTurn({
            services, employee, conversationId: conversation.id, history, userMessage: turn.user, model: MODEL,
          });
        } catch (error) {
          if (!(error instanceof AgentUnavailableError)) throw error;
          unavailable = error.cause instanceof Error ? error.cause.message : "modelo indisponível";
          if (attempt === 1) {
            console.log(`  modelo indisponível, nova tentativa em ${RETRY_WAIT_MS / 1000}s`);
            await sleep(RETRY_WAIT_MS);
          }
        }
      }

      const turnReport: TurnReport = {
        user: turn.user,
        reply: result?.text ?? "",
        latencyMs: Date.now() - started,
        decision: result?.decision ?? null,
        checks: result ? [...turn.checks, ...GLOBAL_CHECKS].map((check) => check(result)) : [],
        unavailable: result ? null : unavailable,
      };
      report.turns.push(turnReport);

      for (const check of turnReport.checks) console.log(`  [${check.pass ? "ok" : "falhou"}] ${check.label}`);
      if (turnReport.unavailable) console.log(`  [indisponível] ${turnReport.unavailable}`);

      if (!result) break;
      history.push(message(conversation.id, "employee", turn.user));
      history.push(message(conversation.id, "agent", result.text, result.attachments, result.decision));

      await sleep(DELAY_MS);
    }

    reports.push(report);
  }
} finally {
  await tdb.close();
}

/* ---------- relatório ---------- */

const allTurns = reports.flatMap((r) => r.turns);
const answered = allTurns.filter((t) => !t.unavailable);
const allChecks = answered.flatMap((t) => t.checks);
const passed = allChecks.filter((c) => c.pass).length;
const percent = allChecks.length ? Math.round((passed / allChecks.length) * 100) : 0;
const avgLatency = answered.length ? Math.round(answered.reduce((s, t) => s + t.latencyMs, 0) / answered.length / 100) / 10 : 0;
const avgSteps = answered.length ? (answered.reduce((s, t) => s + (t.decision?.steps.length ?? 0), 0) / answered.length).toFixed(1) : "0";

const lines: string[] = [
  "# Avaliação do agent",
  "",
  `- Data: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
  `- Modelo: \`${MODEL}\``,
  `- Cenários: ${reports.length} · turnos: ${allTurns.length} (${allTurns.length - answered.length} indisponíveis)`,
  `- **Checagens: ${passed}/${allChecks.length} (${percent}%)**`,
  `- Latência média por turno: ${avgLatency} s · passos médios por turno: ${avgSteps}`,
  "",
  "| Cenário | Regra | Checagens |",
  "|---|---|---|",
  ...reports.map(({ scenario, turns }) => {
    const checks = turns.flatMap((t) => t.checks);
    const ok = checks.filter((c) => c.pass).length;
    const status = turns.some((t) => t.unavailable) ? " (indisponível)" : "";
    return `| ${scenario.title} | ${scenario.rule} | ${ok}/${checks.length}${status} |`;
  }),
  "",
  "## Detalhes",
];

for (const { scenario, turns } of reports) {
  lines.push("", `### ${scenario.id} · ${scenario.title}`);
  turns.forEach((turn, index) => {
    lines.push("", `**Turno ${index + 1}**`, "", `> ${turn.user}`, "");
    if (turn.unavailable) {
      lines.push(`Modelo indisponível: ${turn.unavailable}`);
      return;
    }
    lines.push(`Resposta: ${turn.reply.replace(/\n+/g, " ")}`, "");
    if (turn.decision) {
      const d = turn.decision;
      lines.push(
        `Decisão: ${d.intent} → ${d.action} · confiança ${Math.round(d.confidence * 100)}% · ${(turn.latencyMs / 1000).toFixed(1)} s`,
        `Passos: ${d.steps.map((s) => `${s.label}${s.status === "error" ? " (erro)" : ""}`).join(", ") || "nenhum"}`,
        "",
      );
    }
    for (const check of turn.checks) {
      lines.push(`- [${check.pass ? "x" : " "}] ${check.label}${check.pass || !check.detail ? "" : ` (${check.detail})`}`);
    }
  });
}

await mkdir("evals", { recursive: true });
await writeFile("evals/REPORT.md", `${lines.join("\n")}\n`, "utf8");
console.log(`\nChecagens: ${passed}/${allChecks.length} (${percent}%). Relatório em packages/agent/evals/REPORT.md`);