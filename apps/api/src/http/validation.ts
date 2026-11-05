import type { Context } from "hono";
import { z } from "zod";
import { ApiError } from "./errors";

export async function parseJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.output<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Corpo da requisição inválido.");
  }

  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiError(400, "validation", z.prettifyError(result.error));
  return result.data;
}

const uuidSchema = z.uuid();

/** Id inválido vira 404: não diferencia "formato errado" de "não existe". */
export function parseUuid(value: string | undefined): string {
  const result = uuidSchema.safeParse(value);
  if (!result.success) throw new ApiError(404, "not_found", "Conversa não encontrada.");
  return result.data;
}

export function parseDateQuery(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, "validation", "Data inválida.");
  return date;
}