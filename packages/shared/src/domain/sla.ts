import { isOpenStatus, type Priority, type TicketStatus } from "./ticket";

/**
 * Horário comercial em America/Sao_Paulo. O Brasil não tem horário de verão
 * desde 2019, então um deslocamento fixo de -3h é suficiente e evita dependências.
 * Feriados não são considerados (trade-off documentado no README).
 */
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const BUSINESS_HOURS = { start: 8, end: 18 } as const;

type SlaKind = "clock_hours" | "business_hours" | "business_days";

export const SLA_RULES: Record<Priority, { kind: SlaKind; amount: number; label: string }> = {
  critical: { kind: "clock_hours", amount: 1, label: "1 hora" },
  high: { kind: "business_hours", amount: 4, label: "4 horas úteis" },
  medium: { kind: "business_days", amount: 3, label: "3 dias úteis" },
  low: { kind: "business_days", amount: 5, label: "5 dias úteis" },
};

// "local" = instante deslocado para que os getters UTC leiam o horário de Brasília.
const toLocal = (date: Date): Date => new Date(date.getTime() + BRT_OFFSET_MS);
const fromLocal = (local: Date): Date => new Date(local.getTime() - BRT_OFFSET_MS);

const isWeekend = (local: Date): boolean => {
  const day = local.getUTCDay();
  return day === 0 || day === 6;
};

const atHour = (local: Date, hour: number): Date => {
  const copy = new Date(local);
  copy.setUTCHours(hour, 0, 0, 0);
  return copy;
};

/** Leva o instante para dentro do horário comercial (ou para a próxima abertura). */
function nextBusinessStart(local: Date): Date {
  let current = new Date(local);

  if (current.getUTCHours() >= BUSINESS_HOURS.end) {
    current = atHour(new Date(current.getTime() + DAY_MS), BUSINESS_HOURS.start);
  } else if (current < atHour(current, BUSINESS_HOURS.start)) {
    current = atHour(current, BUSINESS_HOURS.start);
  }

  while (isWeekend(current)) {
    current = atHour(new Date(current.getTime() + DAY_MS), BUSINESS_HOURS.start);
  }

  return current;
}

export function addBusinessHours(start: Date, hours: number): Date {
  let current = nextBusinessStart(toLocal(start));
  let remaining = hours * HOUR_MS;

  for (;;) {
    const endOfDay = atHour(current, BUSINESS_HOURS.end);
    const available = endOfDay.getTime() - current.getTime();

    if (remaining <= available) {
      return fromLocal(new Date(current.getTime() + remaining));
    }

    remaining -= available;
    current = nextBusinessStart(endOfDay);
  }
}

export function addBusinessDays(start: Date, days: number): Date {
  let current = nextBusinessStart(toLocal(start));

  for (let i = 0; i < days; i++) {
    current = new Date(current.getTime() + DAY_MS);
    while (isWeekend(current)) {
      current = new Date(current.getTime() + DAY_MS);
    }
  }

  return fromLocal(current);
}

/** Anexo A: o prazo vale para a primeira resposta e para cada atualização. */
export function computeDueAt(priority: Priority, from: Date): Date {
  const rule = SLA_RULES[priority];

  switch (rule.kind) {
    case "clock_hours":
      return new Date(from.getTime() + rule.amount * HOUR_MS);
    case "business_hours":
      return addBusinessHours(from, rule.amount);
    case "business_days":
      return addBusinessDays(from, rule.amount);
  }
}

export interface OverdueInput {
  priority: Priority;
  status: TicketStatus;
  lastActivityAt: Date;
}

export function isOverdue(input: OverdueInput, now: Date = new Date()): boolean {
  if (!isOpenStatus(input.status)) return false;
  return now.getTime() > computeDueAt(input.priority, input.lastActivityAt).getTime();
}