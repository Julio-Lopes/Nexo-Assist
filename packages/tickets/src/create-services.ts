import type { Database } from "@nexo/db";
import { KnowledgeService } from "./knowledge-service";
import { withInstability, withRetry, type InstabilityOptions, type RetryOptions } from "./resilience";
import { PostgresTicketService } from "./ticket-service";
import type { TicketService } from "./types";

export interface ServicesConfig {
  instability?: InstabilityOptions | null;
  retry?: RetryOptions;
}

export interface Services {
  tickets: TicketService;
  knowledge: KnowledgeService;
}

export function createServices(db: Database, config: ServicesConfig = {}): Services {
  let tickets: TicketService = new PostgresTicketService(db);

  if (config.instability) tickets = withInstability(tickets, config.instability);
  tickets = withRetry(tickets, config.retry ?? { retries: 2, baseDelayMs: 250 });

  return { tickets, knowledge: new KnowledgeService(db) };
}

function toNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** TICKETS_FAILURE_RATE=0.15 e TICKETS_LATENCY_MS=150-600. Taxa 0 desliga a simulação. */
export function instabilityFromEnv(env: NodeJS.ProcessEnv = process.env): InstabilityOptions | null {
  const failureRate = Math.min(1, toNumber(env.TICKETS_FAILURE_RATE, 0));
  if (failureRate <= 0) return null;

  const [min, max] = (env.TICKETS_LATENCY_MS ?? "150-600").split("-");
  const minLatencyMs = toNumber(min, 150);
  const maxLatencyMs = toNumber(max, minLatencyMs);

  return { failureRate, minLatencyMs, maxLatencyMs };
}