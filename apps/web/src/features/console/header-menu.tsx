"use client";

import { EllipsisVertical, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
}

/** Menu dos três pontinhos: fecha ao clicar fora ou com Esc. */
export function HeaderMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Mais opções"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-desk"
      >
        <EllipsisVertical aria-hidden className="size-[18px]" />
      </button>

      {open && (
        <div role="menu" className="absolute top-full right-0 z-20 mt-1 w-64 rounded-xl border border-rule bg-paper p-1 shadow-card">
          {items.map(({ label, icon: Icon, onSelect }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSelect();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] text-ink-2 hover:bg-desk"
            >
              <Icon aria-hidden className="size-4 text-ink-3" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}