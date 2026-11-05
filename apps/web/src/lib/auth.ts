"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { User } from "@nexo/shared";
import { ApiRequestError, api } from "./api-client";

export const sessionKey = ["session"] as const;

export const homeFor = (user: User): string => (user.role === "analyst" ? "/console" : "/chat");

/** null = não autenticado. Erros de rede ficam como erro da query. */
export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async (): Promise<User | null> => {
      try {
        const { user } = await api<{ user: User }>("/auth/me");
        return user;
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 5 * 60_000,
  });
}

/** Só usar dentro de RequireRole, que garante a sessão. */
export function useCurrentUser(): User {
  const { data } = useSession();
  if (!data) throw new Error("useCurrentUser fora de uma rota autenticada");
  return data;
}

export interface LoginInput {
  email: string;
  password: string;
  remember: boolean;
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) => (await api<{ user: User }>("/auth/login", { method: "POST", json: input })).user,
    onSuccess: (user) => queryClient.setQueryData(sessionKey, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => api<{ ok: true }>("/auth/logout", { method: "POST" }),
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(sessionKey, null);
      router.replace("/login");
    },
  });
}