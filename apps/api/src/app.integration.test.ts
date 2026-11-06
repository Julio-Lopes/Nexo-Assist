import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDatabase, type TestDatabase } from "@nexo/db/testing";
import { createApp } from "./app";
import { buildContainer, type Container } from "./context";
import { loadEnv } from "./env";

const ORIGIN = "http://localhost:3000";
const ANA = "ana.souza@nexo.com.br";
const RAFAEL = "rafael.lima@nexo.com.br";
const PATRICIA = "patricia.gomes@nexo.com.br";

let tdb: TestDatabase;
let container: Container;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  tdb = await setupTestDatabase("nexo_test_api");
  const env = loadEnv({ ...process.env, NODE_ENV: "test", DATABASE_URL: tdb.url, WEB_URL: ORIGIN });
  container = buildContainer(env, { db: tdb.db, instability: null });
  app = createApp(container);
});

beforeEach(async () => {
  await tdb.reset();
});

afterAll(async () => {
  await tdb.close();
});

/* ---------- helpers ---------- */

interface CallOptions {
  method?: string;
  cookie?: string;
  body?: unknown;
}

function call(path: string, options: CallOptions = {}) {
  const headers: Record<string, string> = { Origin: ORIGIN };
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  return app.request(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

async function login(email: string): Promise<string> {
  const res = await call("/auth/login", { method: "POST", body: { email, password: "qualquer" } });
  expect(res.status).toBe(200);
  const cookie = res.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Login sem cookie de sessão");
  return cookie;
}

async function body<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function conversationOf(cookie: string): Promise<string> {
  const res = await call("/me/conversation", { cookie });
  return (await body<{ conversation: { id: string } }>(res)).conversation.id;
}

async function statusOf(cookie: string, id: string): Promise<string> {
  const res = await call(`/me/conversation/${id}/messages`, { cookie });
  return (await body<{ conversation: { status: string } }>(res)).conversation.status;
}

/* ---------- testes ---------- */

describe("autenticação e papéis", () => {
  it("recusa e-mail que não existe sem revelar o motivo", async () => {
    const res = await call("/auth/login", { method: "POST", body: { email: "ninguem@nexo.com.br", password: "x" } });
    expect(res.status).toBe(401);
    expect((await body<{ error: { message: string } }>(res)).error.message).toBe("E-mail ou senha inválidos.");
  });

  it("exige sessão nas rotas protegidas", async () => {
    expect((await call("/auth/me")).status).toBe(401);
    expect((await call("/me/tickets")).status).toBe(401);
  });

  it("separa as rotas por papel", async () => {
    const ana = await login(ANA);
    const rafael = await login(RAFAEL);

    expect((await call("/console/conversations", { cookie: ana })).status).toBe(403);
    expect((await call("/me/tickets", { cookie: rafael })).status).toBe(403);
  });

  it("logout invalida a sessão", async () => {
    const ana = await login(ANA);
    await call("/auth/logout", { method: "POST", cookie: ana });
    expect((await call("/auth/me", { cookie: ana })).status).toBe(401);
  });
});

describe("privacidade", () => {
  it("não expõe chamados de outro funcionário", async () => {
    const ana = await login(ANA);

    expect((await call("/me/tickets/INC-20390", { cookie: ana })).status).toBe(404);

    const list = await body<{ tickets: Array<{ requesterId: string }> }>(await call("/me/tickets?all=1", { cookie: ana }));
    expect(list.tickets.every((t) => t.requesterId === "emp-ana")).toBe(true);
  });

  it("não deixa um funcionário ler a conversa de outro", async () => {
    const ana = await login(ANA);
    const bruno = await login("bruno.tavares@nexo.com.br");
    const id = await conversationOf(ana);

    expect((await call(`/me/conversation/${id}/messages`, { cookie: bruno })).status).toBe(404);
  });
});

describe("transferência e console", () => {
  it("percorre transferir, assumir, responder e devolver", async () => {
    const ana = await login(ANA);
    const rafael = await login(RAFAEL);
    const patricia = await login(PATRICIA);
    const id = await conversationOf(ana);

    const handoff = await call(`/me/conversation/${id}/handoff`, { method: "POST", cookie: ana });
    expect(handoff.status).toBe(200);
    expect(await statusOf(ana, id)).toBe("waiting_human");

    const forYou = await body<{ items: Array<{ conversation: { id: string; handoffSummary: string | null } }> }>(
      await call("/console/conversations?filter=for_you", { cookie: rafael }),
    );
    const item = forYou.items.find((i) => i.conversation.id === id);
    expect(item?.conversation.handoffSummary).toContain("Suporte N1");

    expect((await call(`/console/conversations/${id}/take`, { method: "POST", cookie: rafael })).status).toBe(200);
    // Uma conversa já assumida não pode ser tomada nem devolvida por outro analista.
    expect((await call(`/console/conversations/${id}/take`, { method: "POST", cookie: patricia })).status).toBe(409);
    expect((await call(`/console/conversations/${id}/release`, { method: "POST", cookie: patricia })).status).toBe(409);

    const reply = await call(`/console/conversations/${id}/messages`, {
      method: "POST",
      cookie: rafael,
      body: { content: "Oi, Ana! Vou verificar remotamente." },
    });
    expect(reply.status).toBe(201);

    const history = await body<{ messages: Array<{ author: string; content: string }> }>(
      await call(`/me/conversation/${id}/messages`, { cookie: ana }),
    );
    expect(history.messages.some((m) => m.author === "analyst" && m.content.includes("remotamente"))).toBe(true);

    expect((await call(`/console/conversations/${id}/release`, { method: "POST", cookie: rafael })).status).toBe(200);
    expect(await statusOf(ana, id)).toBe("with_agent");
  });

  it("não chama o agent enquanto um analista atende", async () => {
    const ana = await login(ANA);
    const rafael = await login(RAFAEL);
    const id = await conversationOf(ana);

    await call(`/console/conversations/${id}/take`, { method: "POST", cookie: rafael });

    const res = await call(`/me/conversation/${id}/messages`, { method: "POST", cookie: ana, body: { content: "Ainda está aí?" } });
    const stream = await res.text();

    expect(res.status).toBe(200);
    expect(stream).toContain("event: user-message");
    expect(stream).toContain("event: paused");
    expect(stream).not.toContain("event: agent-message");
  });

  it("conversa encerrada recusa mensagens e uma nova começa no próximo acesso", async () => {
    const ana = await login(ANA);
    const rafael = await login(RAFAEL);
    const id = await conversationOf(ana);

    await call(`/console/conversations/${id}/take`, { method: "POST", cookie: rafael });
    expect((await call(`/console/conversations/${id}/close`, { method: "POST", cookie: rafael })).status).toBe(200);

    const res = await call(`/me/conversation/${id}/messages`, { method: "POST", cookie: ana, body: { content: "Oi" } });
    expect(res.status).toBe(409);
    expect(await conversationOf(ana)).not.toBe(id);
  });
});

describe("limites e confirmação", () => {
  it("bloqueia a 31ª mensagem da sessão antes de chamar o agent", async () => {
    const ana = await login(ANA);
    const id = await conversationOf(ana);

    for (let i = 0; i < 30; i++) {
      await container.conversations.appendMessage({
        conversationId: id,
        author: "employee",
        authorId: "emp-ana",
        authorName: "Ana Souza",
        content: `mensagem ${i + 1}`,
      });
    }

    const res = await call(`/me/conversation/${id}/messages`, { method: "POST", cookie: ana, body: { content: "mais uma" } });
    expect(res.status).toBe(429);
  });

  it("confirma um rascunho uma única vez", async () => {
    const ana = await login(ANA);
    const id = await conversationOf(ana);

    const draft = await container.drafts.create({
      conversationId: id,
      employeeId: "emp-ana",
      mode: "create",
      targetTicketId: null,
      note: null,
      payload: {
        type: "INC",
        title: "VPN não conecta no notebook",
        description: "Erro 809 ao conectar na VPN no Windows 11 desde ontem.",
        category: "network_vpn",
        priority: "high",
        affected: "self",
      },
    });

    const first = await call(`/me/conversation/${id}/drafts/${draft.id}/confirm`, { method: "POST", cookie: ana });
    const result = await body<{ messages: Array<{ content: string; decision: { confidence: number } | null }> }>(first);

    expect(first.status).toBe(200);
    expect(result.messages[0]?.content).toContain("INC-20520");
    expect(result.messages[0]?.decision?.confidence).toBe(1);

    const second = await call(`/me/conversation/${id}/drafts/${draft.id}/confirm`, { method: "POST", cookie: ana });
    expect(second.status).toBe(409);
    expect((await call("/me/tickets/INC-20520", { cookie: ana })).status).toBe(200);
  });
});