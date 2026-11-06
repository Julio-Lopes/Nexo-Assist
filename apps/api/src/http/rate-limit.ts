import type { Context } from "hono";

/**
 * Janela deslizante em memória. Basta para uma instância só (Coolify);
 * com várias réplicas, iria para o Redis ou para o Postgres.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Registra a chamada. Retorna 0 se aceita, ou quantos ms faltam para liberar. */
  take(key: string, now: number = Date.now()): number {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);

    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      const oldest = recent[0] ?? now;
      return this.windowMs - (now - oldest);
    }

    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.sweep(now);
    return 0;
  }

  /** Retorna quanto falta para liberar sem registrar uma chamada. */
  retryAfter(key: string, now: number = Date.now()): number {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length < this.limit) return 0;

    this.hits.set(key, recent);
    const oldest = recent[0] ?? now;
    return this.windowMs - (now - oldest);
  }

  private sweep(now: number): void {
    for (const [key, times] of this.hits) {
      if (times.every((t) => now - t >= this.windowMs)) this.hits.delete(key);
    }
  }
}

/** IP do cliente atrás do proxy do Coolify (Traefik). */
export function clientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || c.req.header("x-real-ip") || "local";
}