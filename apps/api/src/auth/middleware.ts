import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { UserRole } from "@nexo/shared";
import type { Container } from "../context";
import { ApiError } from "../http/errors";
import { toUser } from "../http/mappers";
import type { AppEnv } from "../http/types";
import { SESSION_COOKIE, clearSessionCookie, resolveSession } from "./session";

export function requireAuth(container: Container) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (!token) throw new ApiError(401, "unauthenticated", "Entre com seu e-mail corporativo.");

    const session = await resolveSession(container.db, token);
    if (!session) {
      clearSessionCookie(c);
      throw new ApiError(401, "unauthenticated", "Sua sessão expirou. Entre novamente.");
    }

    c.set("user", toUser(session.user));
    c.set("session", { id: session.id, startedAt: session.startedAt });
    await next();
  });
}

export function requireRole(role: UserRole) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (c.get("user").role !== role) throw new ApiError(403, "forbidden", "Acesso não permitido.");
    await next();
  });
}