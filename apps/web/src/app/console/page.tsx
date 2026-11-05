import { RequireRole } from "@/components/auth/require-role";

export default function ConsolePage() {
  return (
    <RequireRole role="analyst">
      <div className="flex min-h-dvh items-center justify-center text-[14px] text-ink-3">Console do analista em construção.</div>
    </RequireRole>
  );
}