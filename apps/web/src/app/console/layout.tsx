import type { ReactNode } from "react";
import { RequireRole } from "@/components/auth/require-role";
import { ConsoleShell } from "@/features/console/console-shell";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="analyst">
      <ConsoleShell>{children}</ConsoleShell>
    </RequireRole>
  );
}