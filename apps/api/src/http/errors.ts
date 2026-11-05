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

export interface ErrorDescription {
  status: ContentfulStatusCode;
  code: string;
  message: string;
}

export function describeError(err: unknown): ErrorDescription {
  if (err instanceof ApiError) return { status: err.status, code: err.code, message: err.message };
  if (err instanceof TicketError) return { status: TICKET_STATUS[err.code], code: err.code, message: err.message };
  if (err instanceof ConversationError) {
    return { status: err.code === "not_found" ? 404 : 409, code: err.code, message: err.message };
  }
  return { status: 500, code: "internal", message: "Erro inesperado. Tente novamente." };
}

export const handleError: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof HTTPException) return err.getResponse();

  const { status, code, message } = describeError(err);
  if (status === 500) console.error("[api] erro não tratado", err);
  return c.json({ error: { code, message } }, status);
};