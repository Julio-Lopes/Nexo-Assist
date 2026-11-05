import type { ReactNode } from "react";
import { RequireRole } from "@/components/auth/require-role";
import { EmployeeShell } from "@/components/shell/employee-shell";

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="employee">
      <EmployeeShell>{children}</EmployeeShell>
    </RequireRole>
  );
}