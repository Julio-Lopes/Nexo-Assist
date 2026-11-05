"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullPageError, FullPageLoading } from "@/components/ui/full-page-state";
import { errorMessage } from "@/lib/api-client";
import { homeFor, useSession } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  const { data: user, isPending, isError, error, refetch } = useSession();

  useEffect(() => {
    if (isPending || isError) return;
    router.replace(user ? homeFor(user) : "/login");
  }, [user, isPending, isError, router]);

  if (isError) return <FullPageError message={errorMessage(error)} onRetry={() => void refetch()} />;
  return <FullPageLoading />;
}