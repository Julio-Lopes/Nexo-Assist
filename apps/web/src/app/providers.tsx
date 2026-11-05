"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiRequestError } from "@/lib/api-client";
import { sessionKey } from "@/lib/auth";

const isUnauthorized = (error: unknown) => error instanceof ApiRequestError && error.status === 401;

/** Não repete erros do cliente (4xx): só rede e servidor. */
const shouldRetry = (failureCount: number, error: unknown) => {
  if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
};

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const queryClient: QueryClient = new QueryClient({
      // Qualquer 401 encerra a sessão local; o guard leva de volta ao login.
      queryCache: new QueryCache({
        onError: (error) => {
          if (isUnauthorized(error)) queryClient.setQueryData(sessionKey, null);
        },
      }),
      mutationCache: new MutationCache({
        onError: (error) => {
          if (isUnauthorized(error)) queryClient.setQueryData(sessionKey, null);
        },
      }),
      defaultOptions: {
        queries: { retry: shouldRetry, refetchOnWindowFocus: false },
      },
    });
    return queryClient;
  });

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}