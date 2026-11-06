"use client";

import { LogOut, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { NexoMark } from "@/components/brand/nexo-mark";
import { useCurrentUser, useLogout } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/people";
import { useConsoleList, type ConsoleFilter } from "./console-api";
import { ConversationList } from "./conversation-list";

function Rail({ waiting }: { waiting: number }) {
  const user = useCurrentUser();
  const logout = useLogout();

  return (
    <nav aria-label="Console" className="hidden w-16 shrink-0 flex-col items-center gap-1.5 border-r border-rule bg-desk py-4 md:flex">
      <div className="flex size-10 items-center justify-center pb-2">
        <NexoMark className="h-[19px] w-[22px] text-primary" />
      </div>

      <Link
        href="/console"
        aria-label={`Conversas, ${waiting} aguardando`}
        className="relative flex size-10 items-center justify-center rounded-xl bg-paper shadow-control"
      >
        <MessageCircle aria-hidden className="size-[19px] text-ink" />
        {waiting > 0 && (
          <span className="absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-cta px-[5px] text-[10px] font-bold text-white ring-2 ring-desk">
            {waiting}
          </span>
        )}
      </Link>

      <div className="flex-1" />

      <button
        type="button"
        aria-label="Sair"
        title="Sair"
        onClick={() => logout.mutate()}
        className="flex size-9 items-center justify-center rounded-lg text-ink-3 hover:bg-paper"
      >
        <LogOut aria-hidden className="size-4" />
      </button>

      <span
        title={`${user.name} · Suporte ${user.supportLevel ?? ""}`}
        className="relative mt-1 flex size-9 items-center justify-center rounded-full bg-primary-soft text-[12.5px] font-bold text-primary-text"
      >
        {initials(user.name)}
        <span aria-hidden className="absolute right-0 bottom-0 size-2.5 rounded-full bg-success ring-2 ring-desk" />
      </span>
    </nav>
  );
}

export function ConsoleShell({ children }: { children: ReactNode }) {
  const params = useParams<{ conversationId?: string }>();
  const selectedId = params.conversationId ?? null;
  const [filter, setFilter] = useState<ConsoleFilter>("for_you");
  const list = useConsoleList(filter);

  return (
    <div className="flex h-dvh bg-paper">
      <Rail waiting={list.data?.counts.for_you ?? 0} />
      <ConversationList
        className={selectedId ? "hidden lg:flex" : "flex"}
        filter={filter}
        onFilterChange={setFilter}
        query={list}
        selectedId={selectedId}
      />
      <div className={cn("min-w-0 flex-1", selectedId ? "flex" : "hidden lg:flex")}>{children}</div>
    </div>
  );
}