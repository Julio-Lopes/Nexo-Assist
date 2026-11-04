export type TicketErrorCode = "not_found" | "unavailable" | "invalid_state" | "validation";

export class TicketError extends Error {
  constructor(
    message: string,
    readonly code: TicketErrorCode,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Também usado quando o chamado existe mas é de outra pessoa (não revela a existência). */
export class TicketNotFoundError extends TicketError {
  constructor(ticketId: string) {
    super(`Chamado ${ticketId} não encontrado.`, "not_found");
  }
}

/** Falha transitória do sistema legado: é a única que justifica retry. */
export class TicketSystemUnavailableError extends TicketError {
  constructor() {
    super("O sistema de chamados está indisponível no momento.", "unavailable");
  }
}

export class InvalidTicketStateError extends TicketError {
  constructor(message: string) {
    super(message, "invalid_state");
  }
}

export class TicketValidationError extends TicketError {
  constructor(message: string) {
    super(message, "validation");
  }
}