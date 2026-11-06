import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  /** Origens permitidas (CORS e CSRF), separadas por vírgula. */
  WEB_URL: z.string().min(1).default("http://localhost:3000"),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(12),
  /** Força o cookie Secure ligado ou desligado. Padrão: ligado em produção. */
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  LLM_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  /** Lida diretamente pelo Mastra; validada aqui só para avisar quando falta. */
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  /** Definida automaticamente pela Vercel. */
  VERCEL: z.string().optional(),
  /** Proteção da cota do LLM (demonstração no free tier). */
  RATE_LIMIT_TURNS_PER_MINUTE: z.coerce.number().int().positive().default(6),
  RATE_LIMIT_TURNS_PER_DAY: z.coerce.number().int().positive().default(60),
  AGENT_DAILY_LIMIT: z.coerce.number().int().positive().default(300),
});

export type Env = z.infer<typeof envSchema> & { origins: string[]; secureCookies: boolean };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(parsed.error)}`);
  }

  const data = parsed.data;
  const origins = data.WEB_URL.split(",").map((o) => o.trim()).filter(Boolean);
  const secureCookies = data.COOKIE_SECURE ? data.COOKIE_SECURE === "true" : data.NODE_ENV === "production";

  return { ...data, origins, secureCookies };
}