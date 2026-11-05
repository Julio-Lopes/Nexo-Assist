import { Hand, Headset, MessageSquareOff } from "lucide-react";
import type { ConversationStatus } from "@nexo/shared";
import { Button } from "@/components/ui/button";

export function ConversationBanner({ status, onRestart }: { status: ConversationStatus; onRestart: () => void }) {
  if (status === "with_agent") return null;

  const content = {
    waiting_human: {
      icon: <Hand aria-hidden className="size-4 text-warning-text" />,
      box: "bg-warning-soft",
      title: "Um analista vai continuar este atendimento",
      body: "O assistente está pausado. Suas mensagens chegam direto para o analista.",
    },
    with_human: {
      icon: <Headset aria-hidden className="size-4 text-primary-text" />,
      box: "bg-primary-soft",
      title: "Você está falando com um analista",
      body: "O assistente volta quando o analista devolver a conversa.",
    },
    closed: {
      icon: <MessageSquareOff aria-hidden className="size-4 text-ink-3" />,
      box: "bg-desk",
      title: "Esta conversa foi encerrada",
      body: "Seus chamados continuam salvos. Comece outra conversa se precisar.",
    },
  }[status];

  return (
    <div role="status" className={`flex items-center gap-3 rounded-xl px-4 py-3 ${content.box}`}>
      {content.icon}
      <div className="min-w-0 flex-1 text-[13.5px]">
        <p className="font-semibold">{content.title}</p>
        <p className="text-ink-2">{content.body}</p>
      </div>
      {status === "closed" && (
        <Button size="sm" variant="primary" onClick={onRestart}>
          Nova conversa
        </Button>
      )}
    </div>
  );
}