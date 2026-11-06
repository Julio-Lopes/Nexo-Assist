import {
  action,
  anyOf,
  attachment,
  draft,
  handoff,
  intent,
  noAttachment,
  noHandoff,
  noSystemCalls,
  textExcludes,
  textIncludes,
  usedTool,
  type Check,
} from "./checks";

export interface ScenarioTurn {
  user: string;
  checks: Check[];
}

export interface Scenario {
  id: string;
  title: string;
  /** Regra do PRD ou do Anexo A que o cenário exercita. */
  rule: string;
  employeeEmail: string;
  turns: ScenarioTurn[];
}

const ANA = "ana.souza@nexo.com.br";
const BRUNO = "bruno.tavares@nexo.com.br";
const ELISA = "elisa.prado@nexo.com.br";

export const SCENARIOS: Scenario[] = [
  {
    id: "kb-horario",
    title: "Dúvida respondida pela central de ajuda",
    rule: "História 1: tirar dúvida sem abrir chamado",
    employeeEmail: ANA,
    turns: [
      {
        user: "Qual o horário de atendimento do service desk?",
        checks: [
          usedTool("search_help_center"),
          textIncludes(/\b8\s?h|8:00/i, "informa o horário das 8h às 18h"),
          noAttachment("draft", "não propõe chamado"),
          noHandoff,
        ],
      },
    ],
  },
  {
    id: "kb-vpn-win10",
    title: "Artigo aplicável ao equipamento (Windows 10)",
    rule: "Usar a central de ajuda antes de abrir chamado",
    employeeEmail: BRUNO,
    turns: [
      {
        user: "Minha VPN está dando erro 809, o que eu faço?",
        checks: [
          usedTool("search_help_center"),
          textIncludes(/reinstal/i, "orienta reinstalar o cliente de VPN"),
          noAttachment("draft", "não propõe chamado"),
        ],
      },
    ],
  },
  {
    id: "vpn-win11",
    title: "Artigo não se aplica, abertura com rascunho e confirmação",
    rule: "Tela 2 e Anexo A: abertura completa, prioridade e confirmação",
    employeeEmail: ANA,
    turns: [
      {
        user: "Meu notebook não conecta na VPN desde ontem. Aparece o erro 809.",
        checks: [
          usedTool("search_help_center"),
          textExcludes(/reinstal/i, "não aplica o artigo que vale só para Windows 10"),
          noAttachment("draft", "pergunta antes de propor (falta quem é afetado)"),
        ],
      },
      {
        user: "Só eu. Tenho uma reunião com um cliente às 14h e preciso da VPN.",
        checks: [
          draft(
            "rascunho INC de Rede e VPN com prioridade alta",
            (d) => d.mode === "create" && d.draft.type === "INC" && d.draft.category === "network_vpn" && d.draft.priority === "high",
          ),
          action("propose_draft"),
        ],
      },
      {
        user: "Pode abrir, confirmo.",
        checks: [action("create_ticket"), attachment("ticket", "mostra o chamado criado")],
      },
    ],
  },
  {
    id: "status-ambiguo",
    title: "Status sem lembrar o número",
    rule: "História 2 e Tela 3: seleção entre chamados abertos",
    employeeEmail: ANA,
    turns: [
      {
        user: "Qual o status do meu chamado?",
        checks: [usedTool("list_my_tickets"), attachment("ticket_selector", "mostra o seletor de chamados")],
      },
    ],
  },
  {
    id: "status-vencido",
    title: "Chamado vencido e oferta de analista",
    rule: "Tela 3: status com prazo vencido",
    employeeEmail: ANA,
    turns: [
      {
        user: "Como está o meu chamado do notebook lento?",
        checks: [
          usedTool("get_ticket"),
          attachment("ticket", "mostra o card do INC-20311", (a) => a.ticketId === "INC-20311"),
          textIncludes(/venc|prazo|atras/i, "avisa que passou do prazo"),
          attachment("options", "oferece opções, incluindo falar com analista"),
        ],
      },
      {
        user: "Falar com um analista",
        checks: [handoff("overdue", "employee_request"), action("handoff")],
      },
    ],
  },
  {
    id: "duplicidade",
    title: "Problema que já tem chamado aberto",
    rule: "Anexo A: sem duplicidade",
    employeeEmail: ANA,
    turns: [
      {
        user: "Meu notebook continua muito lento depois da atualização do Windows. Quero abrir um chamado. Só eu, mas consigo trabalhar.",
        checks: [
          noAttachment("draft", "não cria chamado novo duplicado", (a) => a.mode === "create"),
          anyOf(
            "aponta o INC-20311 existente",
            textIncludes(/INC-20311/, "menciona INC-20311"),
            attachment("ticket", "mostra o card do INC-20311", (a) => a.ticketId === "INC-20311"),
            draft("propõe atualizar o INC-20311", (d) => d.mode === "update" && d.targetTicketId === "INC-20311"),
          ),
        ],
      },
    ],
  },
  {
    id: "reabertura",
    title: "Problema voltou em chamado resolvido recentemente",
    rule: "Anexo A: reabrir resolvido há até 7 dias",
    employeeEmail: ANA,
    turns: [
      {
        user: "A senha do SAP bloqueou de novo, igual aquele chamado de alguns dias atrás. Pode reabrir?",
        checks: [draft("propõe reabrir o INC-20150", (d) => d.mode === "reopen" && d.targetTicketId === "INC-20150")],
      },
    ],
  },
  {
    id: "privacidade",
    title: "Pedido de chamado de outra pessoa",
    rule: "Anexo A: informação só para quem abriu",
    employeeEmail: ANA,
    turns: [
      {
        user: "Qual o status do chamado INC-20390 do Diego?",
        checks: [
          noAttachment("ticket", "não mostra o card do chamado alheio", (a) => a.ticketId === "INC-20390"),
          textExcludes(/10 minutos|macOS|cai a cada/i, "não revela dados do chamado do Diego"),
        ],
      },
    ],
  },
  {
    id: "fora-do-escopo",
    title: "Assunto de RH",
    rule: "Anexo A: apenas assuntos de TI",
    employeeEmail: ANA,
    turns: [
      {
        user: "Quantos dias de férias eu ainda tenho?",
        checks: [intent("out_of_scope"), noSystemCalls, noAttachment("draft", "não propõe chamado"), noHandoff],
      },
    ],
  },
  {
    id: "pede-humano",
    title: "Funcionário pede um atendente",
    rule: "História 5: falar com analista quando preferir",
    employeeEmail: ANA,
    turns: [
      {
        user: "Prefiro falar com um atendente humano, por favor.",
        checks: [handoff("employee_request"), action("handoff")],
      },
    ],
  },
  {
    id: "critico",
    title: "Parada para a equipe inteira",
    rule: "Anexo A: prioridade crítica e transferência em caso crítico",
    employeeEmail: BRUNO,
    turns: [
      {
        user: "O Outlook parou para toda a equipe comercial desde as 9h. Ninguém consegue enviar e-mail e não temos alternativa. Pode abrir um chamado?",
        checks: [
          draft("rascunho de E-mail com prioridade crítica", (d) => d.mode === "create" && d.draft.category === "email" && d.draft.priority === "critical"),
        ],
      },
      {
        user: "Pode abrir.",
        checks: [attachment("ticket", "mostra o chamado criado"), handoff("critical")],
      },
    ],
  },
  {
    id: "requisicao",
    title: "Pedido de acesso sem urgência",
    rule: "Anexo A: REQ e prioridade baixa",
    employeeEmail: ELISA,
    turns: [
      {
        user: "Preciso de acesso ao Power BI para montar um relatório, sem pressa. É só para mim.",
        checks: [draft("requisição (REQ) com prioridade baixa", (d) => d.mode === "create" && d.draft.type === "REQ" && d.draft.priority === "low")],
      },
    ],
  },
  {
    id: "agradecimento",
    title: "Encerramento cordial",
    rule: "Não agir sem necessidade",
    employeeEmail: ANA,
    turns: [
      {
        user: "Obrigada, era só isso!",
        checks: [intent("greeting"), noSystemCalls, noHandoff],
      },
    ],
  },
];