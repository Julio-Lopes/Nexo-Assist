import type { kbArticles, ticketEvents, tickets, users } from "../schema";

type NewUser = typeof users.$inferInsert;
type NewArticle = typeof kbArticles.$inferInsert;
type NewTicket = typeof tickets.$inferInsert;
type NewEvent = typeof ticketEvents.$inferInsert;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Datas relativas a "agora" para que vencido, recente e antigo continuem coerentes em qualquer dia. */
export function buildSeed(now: Date) {
  const ago = (ms: number) => new Date(now.getTime() - ms);

  const seedUsers: NewUser[] = [
    { id: "emp-ana", name: "Ana Souza", email: "ana.souza@nexo.com.br", role: "employee", department: "Financeiro", device: "Notebook Dell Latitude · Windows 11" },
    { id: "emp-bruno", name: "Bruno Tavares", email: "bruno.tavares@nexo.com.br", role: "employee", department: "Comercial", device: "Notebook Lenovo ThinkPad · Windows 10" },
    { id: "emp-carla", name: "Carla Mendes", email: "carla.mendes@nexo.com.br", role: "employee", department: "Controladoria", device: "Notebook Dell Latitude · Windows 11" },
    { id: "emp-diego", name: "Diego Ramos", email: "diego.ramos@nexo.com.br", role: "employee", department: "Marketing", device: "MacBook Air · macOS" },
    { id: "emp-elisa", name: "Elisa Prado", email: "elisa.prado@nexo.com.br", role: "employee", department: "RH", device: "Notebook Lenovo ThinkPad · Windows 10" },
    { id: "anl-rafael", name: "Rafael Lima", email: "rafael.lima@nexo.com.br", role: "analyst", department: "TI", device: null, supportLevel: "N2" },
    { id: "anl-patricia", name: "Patrícia Gomes", email: "patricia.gomes@nexo.com.br", role: "analyst", department: "TI", device: null, supportLevel: "N1" },
  ];

  const articles: NewArticle[] = [
    {
      id: "vpn-erro-809",
      title: "VPN com erro 809",
      body: "Reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. Vale apenas para Windows 10; no Windows 11, abra um chamado.",
      tags: ["vpn", "rede", "erro 809", "windows 10", "conexão"],
    },
    {
      id: "horario-service-desk",
      title: "Horário do service desk",
      body: "De segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.",
      tags: ["horário", "atendimento", "plantão", "service desk"],
    },
    {
      id: "redefinir-senha-rede",
      title: "Como redefinir a senha da rede",
      body: "Acesse senha.nexo.com.br, informe seu e-mail corporativo e confirme o código enviado ao celular cadastrado. A nova senha vale para rede, e-mail e VPN. Se o celular cadastrado mudou, abra um chamado de Acesso.",
      tags: ["senha", "rede", "bloqueio", "acesso", "redefinir"],
    },
    {
      id: "outlook-celular",
      title: "Outlook não sincroniza no celular",
      body: "Remova a conta do app Outlook, reinstale o app e adicione a conta de novo com o e-mail corporativo. Aprove o login no autenticador. Apps de e-mail nativos do celular não são suportados.",
      tags: ["outlook", "e-mail", "celular", "sincronização", "mobile"],
    },
    {
      id: "wifi-visitantes",
      title: "Wi-Fi para visitantes",
      body: "Visitantes usam a rede Nexo-Guest. A senha muda toda segunda-feira e fica com a recepção de cada andar. Funcionários devem usar a rede Nexo-Corp com o login da rede.",
      tags: ["wi-fi", "wifi", "visitante", "rede", "senha"],
    },
    {
      id: "adicionar-impressora",
      title: "Como adicionar uma impressora",
      body: "No Windows, abra Configurações > Impressoras, clique em Adicionar e informe \\\\print.nexo.local. Escolha a impressora do seu andar. No macOS, use o portal de softwares para instalar o pacote de impressoras.",
      tags: ["impressora", "imprimir", "hardware", "instalação"],
    },
    {
      id: "pedir-software",
      title: "Como pedir um software",
      body: "Softwares homologados são instalados pelo portal de softwares, sem chamado. Para um software fora da lista, abra uma requisição de Software informando o nome, o motivo e o aceite do gestor.",
      tags: ["software", "instalar", "programa", "licença", "requisição"],
    },
    {
      id: "lentidao-apos-atualizacao",
      title: "Computador lento após atualização",
      body: "Reinicie o computador duas vezes e rode o diagnóstico Nexo Check pelo portal de softwares. Se a lentidão continuar depois disso, abra um chamado de Hardware.",
      tags: ["lento", "lentidão", "atualização", "windows", "desempenho"],
    },
  ];

  const seedTickets: NewTicket[] = [
    // Ana: vencido, em andamento, aprovado, resolvido recente (reabrível) e resolvido antigo
    {
      id: "INC-20311", type: "INC", requesterId: "emp-ana",
      title: "Notebook lento após atualização do Windows",
      description: "Lentidão geral desde a última atualização do Windows. Reiniciar e rodar o diagnóstico da central de ajuda não resolveu.",
      category: "hardware", priority: "medium", affected: "self", status: "waiting_analyst",
      createdAt: ago(7 * DAY), updatedAt: ago(6 * DAY),
    },
    {
      id: "REQ-10448", type: "REQ", requesterId: "emp-ana",
      title: "Acesso à pasta Financeiro no SharePoint",
      description: "Preciso de acesso de edição à pasta Financeiro/Fechamento no SharePoint para o fechamento mensal.",
      category: "access", priority: "medium", affected: "self", status: "in_progress",
      createdAt: ago(3 * DAY), updatedAt: ago(20 * HOUR),
    },
    {
      id: "REQ-10442", type: "REQ", requesterId: "emp-ana",
      title: "Segundo monitor para home office",
      description: "Pedido de um segundo monitor para o home office, já aprovado pela gestora.",
      category: "hardware", priority: "low", affected: "self", status: "approved",
      createdAt: ago(8 * DAY), updatedAt: ago(2 * DAY),
    },
    {
      id: "INC-20150", type: "INC", requesterId: "emp-ana",
      title: "Senha do SAP bloqueada",
      description: "Senha do SAP bloqueada após tentativas de login com a senha antiga.",
      category: "access", priority: "medium", affected: "self", status: "resolved",
      createdAt: ago(6 * DAY), updatedAt: ago(4 * DAY), resolvedAt: ago(4 * DAY),
    },
    {
      id: "INC-19877", type: "INC", requesterId: "emp-ana",
      title: "Outlook não sincroniza no celular",
      description: "O Outlook do celular parou de receber e-mails novos.",
      category: "email", priority: "medium", affected: "self", status: "resolved",
      createdAt: ago(65 * DAY), updatedAt: ago(63 * DAY), resolvedAt: ago(63 * DAY),
    },
    // Outros funcionários: servem para testar que ninguém vê chamado alheio
    {
      id: "INC-20402", type: "INC", requesterId: "emp-bruno",
      title: "Impressora do 3º andar não imprime",
      description: "A impressora do 3º andar aparece offline para o time comercial desde hoje cedo. Estamos usando a do 2º andar como alternativa.",
      category: "hardware", priority: "medium", affected: "team", status: "open",
      createdAt: ago(5 * HOUR), updatedAt: ago(5 * HOUR),
    },
    {
      id: "REQ-10446", type: "REQ", requesterId: "emp-carla",
      title: "Acesso ao SAP módulo FI",
      description: "Preciso de acesso ao módulo FI do SAP para lançar notas ainda hoje.",
      category: "access", priority: "high", affected: "self", status: "open",
      createdAt: ago(2 * HOUR), updatedAt: ago(2 * HOUR),
    },
    {
      id: "INC-20390", type: "INC", requesterId: "emp-diego",
      title: "VPN cai a cada 10 minutos",
      description: "A VPN conecta, mas cai a cada 10 minutos no macOS.",
      category: "network_vpn", priority: "high", affected: "self", status: "in_progress",
      createdAt: ago(1 * DAY), updatedAt: ago(3 * HOUR),
    },
    {
      id: "INC-20120", type: "INC", requesterId: "emp-elisa",
      title: "Teclado do notebook com teclas falhando",
      description: "Algumas teclas do notebook pararam de funcionar.",
      category: "hardware", priority: "medium", affected: "self", status: "resolved",
      createdAt: ago(14 * DAY), updatedAt: ago(10 * DAY), resolvedAt: ago(10 * DAY),
    },
  ];

  const nameById = new Map(seedUsers.map((u) => [u.id, u.name]));

  const events: NewEvent[] = seedTickets.map((t) => ({
    ticketId: t.id,
    kind: "created",
    authorId: t.requesterId,
    authorName: nameById.get(t.requesterId) ?? "Funcionário",
    body: "Chamado aberto.",
    createdAt: t.createdAt,
  }));

  events.push(
    {
      ticketId: "INC-20311", kind: "comment", authorId: "anl-patricia", authorName: "Patrícia Gomes",
      body: "Recebido. Vamos verificar o driver de vídeo instalado pela atualização.", createdAt: ago(6 * DAY),
    },
    {
      ticketId: "INC-20150", kind: "status_change", authorId: "anl-patricia", authorName: "Patrícia Gomes",
      body: "Senha desbloqueada. Resolvido.", createdAt: ago(4 * DAY),
    },
  );

  return { users: seedUsers, articles, tickets: seedTickets, events };
}