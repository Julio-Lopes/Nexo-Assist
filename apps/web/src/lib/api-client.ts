export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export interface ApiOptions extends Omit<RequestInit, "body"> {
  json?: unknown;
}

/** Cliente da API: sempre envia o cookie de sessão e padroniza os erros. */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { json, headers, ...rest } = options;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      credentials: "include",
      headers: {
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : undefined,
    });
  } catch {
    throw new ApiRequestError(0, "network", "Sem conexão com o servidor. Verifique sua internet e tente de novo.");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiRequestError(
      response.status,
      body?.error?.code ?? "http_error",
      body?.error?.message ?? "Não foi possível concluir a ação. Tente de novo.",
    );
  }

  return (await response.json()) as T;
}

export function errorMessage(error: unknown, fallback = "Algo deu errado. Tente de novo."): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}