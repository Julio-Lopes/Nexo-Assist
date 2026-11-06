"use client";

import { Bot, CircleCheckBig, Hand, Headset, SendHorizontal } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { Conversation } from "@nexo/shared";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";

interface TakeoverBarProps {
  conversation: Conversation;
  employeeFirstName: string;
  mine: boolean;
  pending: { take: boolean; release: boolean; send: boolean };
  onTake: () => void;
  onRelease: () => void;
  onSend: (content: string) => Promise<boolean>;
}

function LockedComposer({ text }: { text: string }) {
  return (
    <div className="flex h-11 items-center rounded-xl bg-desk px-3.5 text-[14.5px] text-ink-3 opacity-60">{text}</div>
  );
}

export function TakeoverBar({ conversation, employeeFirstName, mine, pending, onTake, onRelease, onSend }: TakeoverBarProps) {
  const [text, setText] = useState("");

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const content = text.trim();
    if (!content || pending.send) return;
    setText("");
    const ok = await onSend(content);
    if (!ok) setText(content);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  }

  if (conversation.status === "with_human" && mine) {
    return (
      <form onSubmit={submit} className="flex shrink-0 items-end gap-3 border-t border-rule bg-paper px-5 pt-2.5 pb-3.5">
        <label htmlFor="analyst-composer" className="sr-only">
          Resposta para {employeeFirstName}
        </label>
        <textarea
          id="analyst-composer"
          rows={1}
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Responder ${employeeFirstName}…`}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl bg-desk px-3.5 py-2.5 text-[14.5px] leading-normal outline-none focus:ring-1 focus:ring-cta"
        />
        <Button type="submit" variant="primary" aria-label="Enviar" loading={pending.send} disabled={!text.trim()} className="size-11 rounded-full p-0">
          {!pending.send && <SendHorizontal aria-hidden className="size-[18px]" />}
        </Button>
      </form>
    );
  }

  const info = (() => {
    switch (conversation.status) {
      case "waiting_human":
        return {
          icon: <Hand aria-hidden className="size-[17px] text-warning-text" />,
          box: "bg-warning-soft",
          title: `${employeeFirstName} espera um atendente`,
          body: `Agent pausado${conversation.handoffAt ? ` · transferida ${timeAgo(conversation.handoffAt)}` : ""}`,
        };
      case "with_agent":
        return {
          icon: <Bot aria-hidden className="size-[17px] text-success-text" />,
          box: "bg-success-soft",
          title: "O agent está atendendo",
          body: "Você pode assumir a qualquer momento; o agent é pausado.",
        };
      case "with_human":
        return {
          icon: <Headset aria-hidden className="size-[17px] text-primary-text" />,
          box: "bg-primary-soft",
          title: "Outro analista está atendendo",
          body: "Só quem assumiu pode responder ou devolver ao agent.",
        };
      case "closed":
        return {
          icon: <CircleCheckBig aria-hidden className="size-[17px] text-ink-3" />,
          box: "bg-desk",
          title: "Atendimento encerrado",
          body: conversation.closedAt ? `Encerrado ${timeAgo(conversation.closedAt)}` : "",
        };
    }
  })();

  const canTake = conversation.status === "waiting_human" || conversation.status === "with_agent";

  return (
    <div className="flex shrink-0 flex-col gap-2.5 border-t border-rule bg-paper px-5 pt-3 pb-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`flex size-9 items-center justify-center rounded-full ${info.box}`}>{info.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold">{info.title}</p>
          <p className="text-[12.5px] text-ink-3">{info.body}</p>
        </div>
        {conversation.status === "waiting_human" && (
          <Button onClick={onRelease} loading={pending.release} disabled={pending.take}>
            {!pending.release && <Bot aria-hidden className="size-[15px] text-ink-2" />}
            Devolver ao agent
          </Button>
        )}
        {canTake && (
          <Button variant="primary" onClick={onTake} loading={pending.take} disabled={pending.release}>
            {!pending.take && <Headset aria-hidden className="size-4" />}
            Assumir atendimento
          </Button>
        )}
      </div>
      {conversation.status !== "closed" && <LockedComposer text="Assuma o atendimento para responder" />}
    </div>
  );
}