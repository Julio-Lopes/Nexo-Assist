import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { TicketError, type TicketErrorCode } from "@nexo/tickets";
import { ConversationError } from "../conversations/state";
import type { AppEnv } from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const TICKET_STATUS: Record<TicketErrorCode, ContentfulStatusCode> = {
  not_found: 404,
  invalid_state: 409,
  validation: 422,
  unavailable: 503,
};

const body = (code: string, message: string) => ({ error: { code, message } });

export const handleError: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof ApiError) return c.json(body(err.code, err.message), err.status);
  if (err instanceof TicketError) return c.json(body(err.code, err.message), TICKET_STATUS[err.code]);
  if (err instanceof ConversationError) {
    return c.json(body(err.code, err.message), err.code === "not_found" ? 404 : 409);
  }
  if (err instanceof HTTPException) return err.getResponse();

  console.error("[api] erro não tratado", err);
  return c.json(body("internal", "Erro inesperado. Tente novamente."), 500);
};