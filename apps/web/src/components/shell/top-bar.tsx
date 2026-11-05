import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/** Barra superior das páginas do funcionário (breadcrumb + ações à direita). */
export function TopBar({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-rule px-4 md:px-8">
      <nav aria-label="Você está em" className="flex min-w-0 flex-1 items-center gap-2 text-[13.5px]">
        <span className="hidden text-ink-3 sm:inline">Service desk de TI</span>
        <ChevronRight aria-hidden className="hidden size-3.5 text-ink-3 sm:inline" />
        <span className="truncate font-semibold text-ink">{title}</span>
      </nav>
      {right}
    </header>
  );
}