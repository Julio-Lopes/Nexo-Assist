"use client";

import { LogOut, MessageSquare, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NexoMark } from "@/components/brand/nexo-mark";
import { useCurrentUser, useLogout } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/people";

const NAV: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/chat", label: "Atendimento", icon: MessageSquare },
  { href: "/perfil", label: "Meu perfil", icon: UserRound },
];

function NavLink({ href, label, icon: Icon, active, compact = false }: (typeof NAV)[number] & { active: boolean; compact?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={compact ? label : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors",
        active ? "bg-primary-soft font-semibold text-primary-text" : "font-medium text-ink-2 hover:bg-desk",
      )}
    >
      <Icon aria-hidden className={cn("size-4", active ? "text-primary-text" : "text-ink-3")} />
      {!compact && label}
    </Link>
  );
}

export function EmployeeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const logout = useLogout();

  return (
    <div className="flex h-dvh bg-paper">
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-rule px-3.5 pt-5 pb-3.5 md:flex">
        <div className="flex items-center gap-2.5 px-2">
          <NexoMark className="h-[17px] w-5 text-primary" />
          <span className="text-base font-bold tracking-[-0.2px]">Nexo Assist</span>
        </div>

        <nav aria-label="Menu" className="mt-[22px] flex flex-col gap-0.5">
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} active={pathname.startsWith(item.href)} />
          ))}
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-2.5 border-t border-rule px-2 pt-3.5 pb-1">
          <div className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-[12.5px] font-bold text-primary-text">
            {initials(user.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold">{user.name}</p>
            <p className="truncate text-[11.5px] text-ink-3">{user.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="flex h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-ink-2 hover:bg-desk disabled:opacity-60"
        >
          <LogOut aria-hidden className="size-4 text-ink-3" />
          Sair
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Navegação compacta no celular */}
        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-rule px-3 md:hidden">
          <NexoMark className="mr-2 h-[15px] w-[18px] text-primary" />
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} compact active={pathname.startsWith(item.href)} />
          ))}
          <div className="flex-1" />
          <button
            type="button"
            aria-label="Sair"
            onClick={() => logout.mutate()}
            className="flex size-9 items-center justify-center rounded-lg text-ink-3 hover:bg-desk"
          >
            <LogOut aria-hidden className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}