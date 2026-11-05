import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { AFFECTED, AGENT_ACTIONS, AGENT_INTENTS, CATEGORIES, HANDOFF_REASONS, TICKET_TYPES } from "@nexo/shared";
import {
  askTicketSelection,
  confirmDraft,
  getTicket,
  handoffToAnalyst,
  listMyTickets,
  offerOptions,
  proposeTicketChange,
  proposeTicketDraft,
  recordDecision,
  searchHelpCenter,
} from "./handlers";
import type { TurnContext } from "./ports";

/** As ferramentas fecham sobre o contexto do turno: cada turno tem seu funcionário e seu registro. */
export function createTools(ctx: TurnContext) {
  return {
    list_my_tickets: createTool({
      id: "list_my_tickets",
      description: "Lista os chamados do funcionário (abertos por padrão). Use para consultas de status.",
      inputSchema: z.object({
        includeClosed: z.boolean().default(false).describe("Inclui resolvidos e encerrados."),
      }),
      execute: async (input) => listMyTickets(ctx, input),
    }),

    get_ticket: createTool({
      id: "get_ticket",
      description: "Mostra um chamado do funcionário com status, prazo e últimas atualizações. Exibe o card do chamado.",
      inputSchema: z.object({ ticketId: z.string().describe("Ex.: INC-20311 ou REQ-10442") }),
      execute: async (input) => getTicket(ctx, input),
    }),

    ask_ticket_selection: createTool({
      id: "ask_ticket_selection",
      description: "Exibe um seletor quando não está claro de qual chamado o funcionário fala.",
      inputSchema: z.object({ ticketIds: z.array(z.string()).describe("Ids dos chamados candidatos (2 ou mais).") }),
      execute: async (input) => askTicketSelection(ctx, input),
    }),

    search_help_center: createTool({
      id: "search_help_center",
      description: "Busca artigos na central de ajuda. Use para dúvidas e antes de abrir chamado para problemas comuns.",
      inputSchema: z.object({ query: z.string().describe("Palavras-chave do problema, ex.: 'vpn erro 809'.") }),
      execute: async (input) => searchHelpCenter(ctx, input),
    }),

    propose_ticket_draft: createTool({
      id: "propose_ticket_draft",
      description:
        "Monta o rascunho de um chamado novo para o funcionário conferir. A prioridade e o prazo são calculados pelo sistema. Não cria o chamado.",
      inputSchema: z.object({
        type: z.enum(TICKET_TYPES).describe("INC se algo parou ou não funciona; REQ para pedidos."),
        category: z.enum(CATEGORIES),
        title: z.string().describe("Curto e específico."),
        description: z.string().describe("Sintoma, desde quando, equipamento e o que já foi tentado."),
        affected: z.enum(AFFECTED).describe("self, team ou company."),
        blocking: z.boolean().describe("Impede de trabalhar, sem alternativa."),
        deadlineToday: z.boolean().describe("Há um compromisso hoje em risco."),
        notDuplicateOf: z.array(z.string()).default([]).describe("Chamados que o funcionário disse serem outro problema."),
      }),
      execute: async (input) => proposeTicketDraft(ctx, input),
    }),

    propose_ticket_change: createTool({
      id: "propose_ticket_change",
      description:
        "Monta um rascunho para complementar (update) um chamado aberto ou reabrir (reopen) um resolvido há até 7 dias. Não aplica a mudança.",
      inputSchema: z.object({
        ticketId: z.string(),
        mode: z.enum(["update", "reopen"]),
        note: z.string().describe("Informação nova ou motivo da reabertura."),
      }),
      execute: async (input) => proposeTicketChange(ctx, input),
    }),

    confirm_draft: createTool({
      id: "confirm_draft",
      description: "Aplica um rascunho pendente SOMENTE quando o funcionário confirmou por texto.",
      inputSchema: z.object({ draftId: z.string().describe("Ex.: D-381") }),
      execute: async (input) => confirmDraft(ctx, input),
    }),

    offer_options: createTool({
      id: "offer_options",
      description: "Mostra de 2 a 4 botões de resposta rápida.",
      inputSchema: z.object({
        question: z.string().nullable().default(null).describe("Pergunta curta exibida acima dos botões."),
        options: z.array(z.string()).describe("Rótulos curtos dos botões."),
      }),
      execute: async (input) => offerOptions(ctx, input),
    }),

    handoff_to_analyst: createTool({
      id: "handoff_to_analyst",
      description: "Transfere a conversa para um analista humano, com um resumo do caso.",
      inputSchema: z.object({
        reason: z.enum(HANDOFF_REASONS).describe("employee_request, critical, overdue ou low_confidence."),
        summary: z.string().describe("Resumo para o analista: problema, o que já foi feito e o que falta."),
        ticketId: z.string().nullable().default(null).describe("Chamado relacionado, se houver."),
      }),
      execute: async (input) => handoffToAnalyst(ctx, input),
    }),

    record_decision: createTool({
      id: "record_decision",
      description: "Registra o que você entendeu e decidiu neste turno. Chame uma vez por resposta.",
      inputSchema: z.object({
        intent: z.enum(AGENT_INTENTS),
        understanding: z.string().describe("O que você entendeu do pedido, em uma frase."),
        action: z.enum(AGENT_ACTIONS).describe("A ação principal deste turno."),
        confidence: z.number().describe("De 0 a 1."),
        reason: z.string().describe("Por que essa ação, citando a regra quando houver."),
        rulesApplied: z.array(z.string()).default([]).describe("Ex.: 'Sem duplicidade', 'Confirmar antes de criar'."),
      }),
      execute: async (input) => recordDecision(ctx, input),
    }),
  };
}