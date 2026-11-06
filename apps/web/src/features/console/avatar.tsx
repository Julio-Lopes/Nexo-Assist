import { cn } from "@/lib/cn";
import { initials } from "@/lib/people";

// Paleta do protótipo: fundo suave + texto forte.
const PALETTE = [
  ["#DCE9F7", "#0062C4"],
  ["#F6E3D3", "#9A4A12"],
  ["#E6E1F7", "#5B3FC4"],
  ["#DDF0E6", "#1E7A4C"],
  ["#F7E1E6", "#A3324F"],
  ["#E5E8EC", "#3D4656"],
  ["#FBEFD0", "#8A6100"],
] as const;

function colorsFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length] ?? PALETTE[0];
}

export function Avatar({ name, size = 46, className }: { name: string; size?: number; className?: string }) {
  const [background, color] = colorsFor(name);
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold", className)}
      style={{ width: size, height: size, background, color, fontSize: size * 0.34 }}
    >
      {initials(name)}
    </span>
  );
}