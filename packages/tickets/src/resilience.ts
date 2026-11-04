import { TicketSystemUnavailableError } from "./errors";

type Sleep = (ms: number) => Promise<void>;
type AnyMethod = (...args: unknown[]) => unknown;

const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export interface InstabilityOptions {
  /** Probabilidade (0 a 1) de cada chamada falhar. */
  failureRate: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  random?: () => number;
  sleep?: Sleep;
}

/**
 * Simula o sistema legado: adiciona latência e, às vezes, falha ANTES de executar.
 * Chamadas internas da implementação não passam pelo proxy.
 */
export function withInstability<T extends object>(target: T, options: InstabilityOptions): T {
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? defaultSleep;
  const span = Math.max(0, options.maxLatencyMs - options.minLatencyMs);

  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value: unknown = Reflect.get(obj, prop, receiver);
      if (typeof value !== "function") return value;

      return async (...args: unknown[]) => {
        await sleep(options.minLatencyMs + random() * span);
        if (random() < options.failureRate) throw new TicketSystemUnavailableError();
        return (value as AnyMethod).apply(obj, args);
      };
    },
  });
}

export interface RetryEvent {
  method: string;
  attempt: number;
  error: unknown;
}

export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (event: RetryEvent) => void;
  sleep?: Sleep;
}

const isTransient = (error: unknown): boolean => error instanceof TicketSystemUnavailableError;

/** Retry com backoff exponencial, apenas para falhas transitórias. */
export function withRetry<T extends object>(target: T, options: RetryOptions): T {
  const shouldRetry = options.shouldRetry ?? isTransient;
  const sleep = options.sleep ?? defaultSleep;

  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value: unknown = Reflect.get(obj, prop, receiver);
      if (typeof value !== "function") return value;

      return async (...args: unknown[]) => {
        let attempt = 0;
        for (;;) {
          try {
            return await (value as AnyMethod).apply(obj, args);
          } catch (error) {
            if (attempt >= options.retries || !shouldRetry(error)) throw error;
            attempt++;
            options.onRetry?.({ method: String(prop), attempt, error });
            await sleep(options.baseDelayMs * 2 ** (attempt - 1));
          }
        }
      };
    },
  });
}