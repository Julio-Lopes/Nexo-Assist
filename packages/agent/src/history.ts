import type { Message, MessageAttachment } from "@nexo/shared";
import type { CoreAssistantMessage, CoreUserMessage } from "@mastra/core/llm";

export type ModelMessage = CoreUserMessage | CoreAssistantMessage;

/** Janela de contexto: controla custo por turno sem perder o fio da conversa. */
const MAX_HISTORY = 16;

function describeAttachment(attachment: MessageAttachment): string {
  switch (attachment.kind) {
    case "ticket":
      return `card do chamado ${attachment.ticketId}`;
    case "ticket_selector":
      return `seletor de chamados: ${attachment.ticketIds.join(", ")}`;
    case "draft": {
      const target = attachment.targetTicketId ? ` para ${attachment.targetTicketId}` : "";
      return `rascunho ${attachment.draftId} (${attachment.mode}${target}, ${attachment.state}): "${attachment.draft.title}"`;
    }
    case "options":
      return `opções: ${attachment.options.map((o) => o.label).join(" | ")}`;
  }
}

function toModelMessage(message: Message): ModelMessage {
  switch (message.author) {
    case "employee":
      return { role: "user", content: message.content };
    case "agent": {
      const cards = message.attachments.map(describeAttachment);
      return {
        role: "assistant",
        content: cards.length ? `${message.content}\n[${cards.join("; ")}]` : message.content,
      };
    }
    case "analyst":
      return { role: "assistant", content: `[Analista ${message.authorName ?? ""}]: ${message.content}` };
    case "system":
      return { role: "assistant", content: `[evento: ${message.content}]` };
  }
}

/** Junta mensagens seguidas do mesmo papel e garante que a conversa comece pelo usuário. */
function normalize(messages: ModelMessage[]): ModelMessage[] {
  const merged: ModelMessage[] = [];
  for (const message of messages) {
    const last = merged.at(-1);
    if (last && last.role === message.role) last.content = `${last.content}\n${message.content}`;
    else merged.push({ ...message });
  }
  while (merged[0]?.role === "assistant") merged.shift();
  return merged;
}

export function buildModelMessages(history: Message[], userMessage: string): ModelMessage[] {
  const recent = history.slice(-MAX_HISTORY).map(toModelMessage);
  return normalize([...recent, { role: "user", content: userMessage }]);
}