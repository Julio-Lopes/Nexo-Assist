"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { UserRole } from "@nexo/shared";
import { errorMessage } from "@/lib/api-client";
import { homeFor, useSession } from "@/lib/auth";
import { FullPageError, FullPageLoading } from "@/components/ui/full-page-state";

/** Guarda de rota no cliente: o cookie de sessão pertence ao domínio da API. */
export function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const router = useRouter();
  const { data: user, isPending, isError, error, refetch } = useSession();

  useEffect(() => {
    if (isPending || isError) return;
    if (!user) router.replace("/login");
    else if (user.role !== role) router.replace(homeFor(user));
  }, [user, isPending, isError, role, router]);

  if (isError) {
    return <FullPageError message={errorMessage(error, "Não foi possível verificar sua sessão.")} onRetry={() => void refetch()} />;
  }
  if (isPending || !user || user.role !== role) return <FullPageLoading />;

  return children;
}