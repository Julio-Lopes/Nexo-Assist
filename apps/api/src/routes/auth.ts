import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { z } from "zod";
import { eq, users } from "@nexo/db";
import { requireAuth } from "../auth/middleware";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  revokeSession,
  setSessionCookie,
} from "../auth/session";
import type { Container } from "../context";
import { ApiError } from "../http/errors";
import { toUser } from "../http/mappers";
import type { AppEnv } from "../http/types";
import { parseJson } from "../http/validation";
import { SlidingWindowLimiter, clientIp } from "../http/rate-limit";

const REMEMBER_TTL_HOURS = 24 * 7;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
  password: z.string().min(1, "Informe a senha."),
  remember: z.boolean().default(false),
});

export function authRoutes(container: Container) {
  const app = new Hono<AppEnv>();
  const loginAttempts = new SlidingWindowLimiter(10, 5 * 60_000);

  app.post("/login", async (c) => {
    const ip = clientIp(c);
    if (loginAttempts.retryAfter(ip) > 0) {
      throw new ApiError(429, "too_many_attempts", "Muitas tentativas de login. Tente de novo em alguns minutos.");
    }

    const { email, remember } = await parseJson(c, loginSchema);

    // Protótipo (PRD, Tela 1): qualquer senha vale para usuários cadastrados.
    const [user] = await container.db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      loginAttempts.take(ip);
      throw new ApiError(401, "invalid_credentials", "E-mail ou senha inválidos.");
    }

    const ttl = remember ? REMEMBER_TTL_HOURS : container.env.SESSION_TTL_HOURS;
    const session = await createSession(container.db, user.id, ttl);
    setSessionCookie(c, session.token, session.expiresAt, container.env);

    return c.json({ user: toUser(user) });
  });

  app.post("/logout", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await revokeSession(container.db, token);
    clearSessionCookie(c);
    return c.json({ ok: true });
  });

  app.get("/me", requireAuth(container), (c) => c.json({ user: c.get("user") }));

  return app;
}