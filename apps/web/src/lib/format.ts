const TZ = "America/Sao_Paulo";

const timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayMonthFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "short" });

export const formatTime = (iso: string): string => timeFmt.format(new Date(iso));

/** "16 out" */
export function formatDayMonth(iso: string): string {
  const parts = dayMonthFmt.formatToParts(new Date(iso));
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = (parts.find((p) => p.type === "month")?.value ?? "").replace(".", "");
  return `${day} ${month}`;
}

/** "16 out, 14:20" */
export const formatDateTime = (iso: string): string => `${formatDayMonth(iso)}, ${formatTime(iso)}`;

/** Só o horário quando é hoje; data e horário nos outros dias. */
export function formatDue(iso: string, now: Date = new Date()): string {
  return formatDayMonth(iso) === formatDayMonth(now.toISOString()) ? formatTime(iso) : formatDateTime(iso);
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}

/** "Hoje", "Ontem" ou "16 out" */
export function formatRelativeDay(iso: string, now: Date = new Date()): string {
  const day = formatDayMonth(iso);
  if (day === formatDayMonth(now.toISOString())) return "Hoje";
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (day === formatDayMonth(yesterday.toISOString())) return "Ontem";
  return day;
}

/** Horário se for hoje; "ontem" ou a data nos outros casos. */
export function formatListTime(iso: string, now: Date = new Date()): string {
  const day = formatRelativeDay(iso, now);
  if (day === "Hoje") return formatTime(iso);
  return day === "Ontem" ? "ontem" : day;
}