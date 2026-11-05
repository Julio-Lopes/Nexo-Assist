import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  /** Origens permitidas (CORS e CSRF), separadas por vírgula. */
  WEB_URL: z.string().min(1).default("http://localhost:3000"),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(12),
  LLM_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  /** Lida diretamente pelo Mastra; validada aqui só para avisar quando falta. */
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  /** Definida automaticamente pela Vercel. */
  VERCEL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema> & { origins: string[] };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(parsed.error)}`);
  }

  const origins = parsed.data.WEB_URL.split(",").map((o) => o.trim()).filter(Boolean);
  return { ...parsed.data, origins };
}