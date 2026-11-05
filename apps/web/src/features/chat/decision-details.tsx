import { CircleAlert, CircleCheck } from "lucide-react";
import { AGENT_ACTION_LABELS, AGENT_INTENT_LABELS, type AgentDecision } from "@nexo/shared";
import { cn } from "@/lib/cn";

function confidenceLevel(confidence: number) {
  if (confidence >= 0.85) return { label: "Alta", bar: "bg-success", text: "text-success-text" };
  if (confidence >= 0.6) return { label: "Média", bar: "bg-primary", text: "text-primary-text" };
  return { label: "Baixa", bar: "bg-warning", text: "text-warning-text" };
}

/** O detalhe da decisão: o que entendeu, o que fez, com que segurança e por quê. */
export function DecisionDetails({ decision }: { decision: AgentDecision }) {
  const percent = Math.round(decision.confidence * 100);
  const level = confidenceLevel(decision.confidence);

  return (
    <section aria-label="Detalhes da decisão" className="w-full max-w-[600px] rounded-xl border border-rule bg-desk p-4 text-[13px] leading-normal">
      <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-[112px_1fr]">
        <dt className="text-ink-3">O que entendi</dt>
        <dd className="flex flex-wrap items-center gap-2 text-ink">
          {decision.understanding}
          <span className="rounded-md bg-paper px-1.5 py-px text-[11.5px] font-medium text-ink-2 ring-1 ring-rule">
            {AGENT_INTENT_LABELS[decision.intent]}
          </span>
        </dd>

        <dt className="text-ink-3">O que fiz</dt>
        <dd className="font-medium text-ink">{AGENT_ACTION_LABELS[decision.action]}</dd>

        <dt className="text-ink-3">Confiança</dt>
        <dd className="flex items-center gap-2.5">
          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-ink/10" aria-hidden>
            <span className={cn("block h-full rounded-full", level.bar)} style={{ width: `${percent}%` }} />
          </span>
          <span className={cn("font-medium", level.text)}>
            {percent}% · {level.label}
          </span>
        </dd>

        <dt className="text-ink-3">Por quê</dt>
        <dd className="text-ink-2">{decision.reason}</dd>

        {decision.rulesApplied.length > 0 && (
          <>
            <dt className="text-ink-3">Regras</dt>
            <dd className="flex flex-wrap gap-1.5">
              {decision.rulesApplied.map((rule) => (
                <span key={rule} className="rounded-md bg-primary-soft px-2 py-0.5 text-[12px] text-primary-text">
                  {rule}
                </span>
              ))}
            </dd>
          </>
        )}
      </dl>

      {decision.steps.length > 0 && (
        <div className="mt-4 border-t border-rule pt-3">
          <p className="mb-2 text-ink-3">Passos</p>
          <ol className="flex flex-col gap-2">
            {decision.steps.map((step, index) => (
              <li key={`${step.tool}-${index}`} className="flex gap-2">
                {step.status === "success" ? (
                  <CircleCheck aria-label="ok" className="mt-0.5 size-3.5 shrink-0 text-success" />
                ) : (
                  <CircleAlert aria-label="falhou" className="mt-0.5 size-3.5 shrink-0 text-danger" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className={cn("font-medium", step.status === "error" ? "text-danger-text" : "text-ink")}>
                      {step.label}
                    </span>
                    {step.durationMs > 0 && <span className="font-data text-[11.5px] text-ink-3">{step.durationMs} ms</span>}
                  </p>
                  {step.summary && <p className="text-ink-3">{step.summary}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}