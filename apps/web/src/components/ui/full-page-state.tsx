import { Button } from "./button";
import { Spinner } from "./spinner";

export function FullPageLoading({ label = "Carregando" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center gap-2 text-[14px] text-ink-3">
      <Spinner />
      {label}
    </div>
  );
}

export function FullPageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="max-w-sm text-[15px] text-ink-2">{message}</p>
      <Button onClick={onRetry}>Tentar de novo</Button>
    </div>
  );
}