import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";
import type { Container } from "./context";
import { handleError } from "./http/errors";
import type { AppEnv } from "./http/types";
import { authRoutes } from "./routes/auth";
import { consoleRoutes } from "./routes/console";
import { employeeRoutes } from "./routes/employee";
import { healthRoutes } from "./routes/health";
import { bodyLimit } from "hono/body-limit";

export function createApp(container: Container) {
  const app = new Hono<AppEnv>();
  const { origins } = container.env;

  app.use("*", logger());
  app.use(
    "*",
    bodyLimit({
      maxSize: 32 * 1024,
      onError: (c) => c.json({ error: { code: "payload_too_large", message: "Requisição muito grande." } }, 413),
    }),
  );
  app.use(
    "*",
    cors({
      origin: origins,
      credentials: true,
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  );
  app.use("*", csrf({ origin: origins }));

  app.route("/health", healthRoutes(container));
  app.route("/auth", authRoutes(container));
  app.route("/me", employeeRoutes(container));
  app.route("/console", consoleRoutes(container));

  app.notFound((c) => c.json({ error: { code: "not_found", message: "Rota não encontrada." } }, 404));
  app.onError(handleError);

  return app;
}