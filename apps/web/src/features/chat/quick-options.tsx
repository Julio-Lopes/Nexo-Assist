import { SYSTEM_OPTION_IDS, type QuickOption } from "@nexo/shared";
import { cn } from "@/lib/cn";

const SYSTEM_IDS = new Set<string>(Object.values(SYSTEM_OPTION_IDS));

interface QuickOptionsProps {
  question: string | null;
  options: QuickOption[];
  answer: string | null;
  disabled: boolean;
  onSend: (text: string) => void;
  onSystemOption: (id: string) => void;
}

export function QuickOptions({ question, options, answer, disabled, onSend, onSystemOption }: QuickOptionsProps) {
  return (
    <div className="flex max-w-[600px] flex-col gap-2">
      {question && <p className="text-[14.5px] font-semibold">{question}</p>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = answer === option.label;
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => (SYSTEM_IDS.has(option.id) ? onSystemOption(option.id) : onSend(option.label))}
              className={cn(
                "rounded-lg border px-3 py-[7px] text-[13.5px] font-medium transition-colors",
                selected ? "border-primary bg-primary-soft text-primary-text" : "border-rule bg-paper text-ink",
                "enabled:hover:border-primary enabled:hover:bg-primary-soft",
                "disabled:cursor-default",
                !selected && disabled && "opacity-60",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}