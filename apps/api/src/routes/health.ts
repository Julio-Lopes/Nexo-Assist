import { Hono } from "hono";
import { sql } from "@nexo/db";
import type { Container } from "../context";
import type { AppEnv } from "../http/types";

export function healthRoutes(container: Container) {
  const app = new Hono<AppEnv>();

  app.get("/", async (c) => {
    await container.db.execute(sql`select 1`);
    return c.json({ ok: true, db: "up" });
  });

  return app;
}