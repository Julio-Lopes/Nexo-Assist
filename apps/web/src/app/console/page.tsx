import { MessageCircle } from "lucide-react";

export default function ConsoleHome() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-chat px-6 text-center">
      <MessageCircle aria-hidden className="size-8 text-ink-3" />
      <p className="text-[15px] font-medium text-ink-2">Selecione uma conversa</p>
      <p className="max-w-xs text-[13.5px] text-ink-3">
        As conversas que precisam de você aparecem em “Para você”, com o motivo da transferência.
      </p>
    </div>
  );
}