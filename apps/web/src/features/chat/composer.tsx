"use client";

import { ArrowUp } from "lucide-react";
import { useLayoutEffect, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import type { MessageUsage } from "@nexo/shared";
import { Button } from "@/components/ui/button";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  placeholder: string;
  disabled: boolean;
  sending: boolean;
  usage: MessageUsage;
  notice: string | null;
}

export function Composer({ value, onChange, onSubmit, inputRef, placeholder, disabled, sending, usage, notice }: ComposerProps) {
  // Cresce com o texto até um limite.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value, inputRef]);

  const canSend = value.trim().length > 0 && !disabled && !sending;

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (canSend) onSubmit(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <form
        onSubmit={submit}
        className="flex items-end gap-2 rounded-xl border border-line bg-paper py-1.5 pr-1.5 pl-4 shadow-control transition-colors focus-within:border-cta focus-within:ring-1 focus-within:ring-cta"
      >
        <label htmlFor="composer" className="sr-only">
          Mensagem
        </label>
        <textarea
          id="composer"
          ref={inputRef}
          rows={1}
          value={value}
          maxLength={1000}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-2 text-[14.5px] leading-normal outline-none placeholder:text-ink-3 disabled:cursor-not-allowed"
        />
        <Button type="submit" variant="primary" disabled={!canSend} loading={sending} className="h-9 rounded-md px-3">
          {!sending && <ArrowUp aria-hidden className="size-3.5" />}
          Enviar
        </Button>
      </form>
      <div className="flex justify-between gap-3 text-[12.5px] text-ink-3">
        <span>{notice}</span>
        <span className={usage.used >= usage.limit ? "text-danger-text" : undefined}>
          {usage.used}/{usage.limit} mensagens nesta sessão
        </span>
      </div>
    </div>
  );
}