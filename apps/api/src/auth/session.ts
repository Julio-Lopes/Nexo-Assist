import { createHash, randomBytes } from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { and, eq, gt, sessions, users, type Database, type UserRow } from "@nexo/db";
import type { Env } from "../env";

export const SESSION_COOKIE = "nexo_session";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(db: Database, userId: string, ttlHours: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export interface ResolvedSession {
  id: string;
  startedAt: Date;
  user: UserRow;
}

export async function resolveSession(db: Database, token: string): Promise<ResolvedSession | null> {
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return row ? { id: row.session.id, startedAt: row.session.createdAt, user: row.user } : null;
}

export async function revokeSession(db: Database, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export function setSessionCookie(c: Context, token: string, expiresAt: Date, env: Env): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}