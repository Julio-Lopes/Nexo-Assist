import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { MESSAGE_LIMIT_PER_SESSION, ticketNumberSchema, type ChatStreamEvent } from "@nexo/shared";
import { TicketNotFoundError } from "@nexo/tickets";
import { requireAuth, requireRole } from "../auth/middleware";
import type { Container } from "../context";
import { ApiError, describeError } from "../http/errors";
import { toConversation, toMessage } from "../http/mappers";
import type { AppEnv } from "../http/types";
import { parseDateQuery, parseJson, parseUuid } from "../http/validation";

const messageSchema = z.object({
  content: z.string().trim().min(1, "Escreva uma mensagem.").max(1000, "Mensagem muito longa."),
});

function parseDraftId(value: string | undefined): string {
  const id = value?.trim().toUpperCase();
  if (!id || !/^D-\d+$/.test(id)) throw new ApiError(404, "not_found", "Rascunho não encontrado.");
  return id;
}

/** Rotas do funcionário. Tudo é filtrado pelo usuário da sessão. */
export function employeeRoutes(container: Container) {
  const app = new Hono<AppEnv>();
  const { conversations, tickets, chat } = container;

  app.use("*", requireAuth(container), requireRole("employee"));

  app.get("/conversation", async (c) => {
    const user = c.get("user");
    const conversation = await conversations.getOrCreateActive(user.id);

    const [history, used] = await Promise.all([
      conversations.listMessages(conversation.id),
      conversations.countEmployeeMessagesSince(conversation.id, c.get("session").startedAt),
    ]);

    return c.json({
      conversation: toConversation(conversation),
      messages: history.map(toMessage),
      usage: { used, limit: MESSAGE_LIMIT_PER_SESSION },
    });
  });

  app.get("/conversation/:id/messages", async (c) => {
    const id = parseUuid(c.req.param("id"));
    const after = parseDateQuery(c.req.query("after"));

    const conversation = await conversations.getForEmployee(c.get("user").id, id);
    const list = await conversations.listMessages(id, after);

    return c.json({ conversation: toConversation(conversation), messages: list.map(toMessage) });
  });

  /** Envia uma mensagem e devolve o turno do agent em streaming (SSE). */
  app.post("/conversation/:id/messages", async (c) => {
    const id = parseUuid(c.req.param("id"));
    const { content } = await parseJson(c, messageSchema);
    const prepared = await chat.prepareTurn(c.get("user"), id, c.get("session").startedAt);

    return streamSSE(c, async (stream) => {
      // Se o cliente desconectar, o turno continua e é salvo; só paramos de escrever.
      const send = async (event: ChatStreamEvent) => {
        if (stream.aborted) return;
        try {
          await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
        } catch {
          // conexão encerrada pelo cliente
        }
      };

      try {
        const outcome = await chat.runTurn(prepared, content, {
          onUserMessage: (message, usage) => send({ type: "user-message", message, usage }),
          onStep: (step) => void send({ type: "step", step }),
          onText: (delta) => void send({ type: "text", delta }),
        });

        if (outcome.kind === "paused") {
          await send({ type: "paused", conversation: outcome.conversation });
        } else {
          await send({
            type: "agent-message",
            message: outcome.message,
            followUps: outcome.followUps,
            conversation: outcome.conversation,
          });
        }
      } catch (error) {
        const { status, code, message } = describeError(error);
        if (status === 500) console.error("[chat] falha no turno", error);
        await send({ type: "error", code, message });
      }

      await send({ type: "done" });
    });
  });

  app.post("/conversation/:id/drafts/:draftId/confirm", async (c) => {
    const result = await chat.confirmDraft(c.get("user"), parseUuid(c.req.param("id")), parseDraftId(c.req.param("draftId")));
    return c.json(result);
  });

  app.post("/conversation/:id/drafts/:draftId/cancel", async (c) => {
    const result = await chat.cancelDraft(c.get("user"), parseUuid(c.req.param("id")), parseDraftId(c.req.param("draftId")));
    return c.json(result);
  });

  app.post("/conversation/:id/handoff", async (c) => {
    const result = await chat.requestHandoff(c.get("user"), parseUuid(c.req.param("id")));
    return c.json(result);
  });

  app.get("/tickets", async (c) => {
    const list = await tickets.listForRequester(c.get("user").id, {
      includeClosed: c.req.query("all") === "1",
    });
    return c.json({ tickets: list });
  });

  app.get("/tickets/:id", async (c) => {
    const parsed = ticketNumberSchema.safeParse(c.req.param("id"));
    if (!parsed.success) throw new TicketNotFoundError(c.req.param("id"));

    const userId = c.get("user").id;
    const [ticket, events] = await Promise.all([
      tickets.getForRequester(userId, parsed.data),
      tickets.listEvents(userId, parsed.data),
    ]);

    return c.json({ ticket, events });
  });

  return app;
}