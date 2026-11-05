import type { ReactNode } from "react";
import { PRIORITY_LABELS, type Priority } from "@nexo/shared";
import { cn } from "@/lib/cn";
import { PRIORITY_DOT } from "./styles";

export function CardShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("w-full max-w-[600px] overflow-hidden rounded-2xl border border-ink/9 bg-paper shadow-card", className)}>
      {children}
    </div>
  );
}

export function Dot({ className }: { className: string }) {
  return <span aria-hidden className={cn("inline-block size-1.5 shrink-0 rounded-full", className)} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-[12.5px] text-ink-3">{label}</dt>
      <dd className="flex flex-wrap items-center gap-x-1.5 text-[14.5px] font-medium">{children}</dd>
    </div>
  );
}

export function PriorityValue({ priority }: { priority: Priority }) {
  return (
    <span className="flex items-center gap-1.5">
      <Dot className={PRIORITY_DOT[priority]} />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}