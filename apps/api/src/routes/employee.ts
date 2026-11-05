import { Hono } from "hono";
import { MESSAGE_LIMIT_PER_SESSION, ticketNumberSchema } from "@nexo/shared";
import { TicketNotFoundError } from "@nexo/tickets";
import { requireAuth, requireRole } from "../auth/middleware";
import type { Container } from "../context";
import { toConversation, toMessage } from "../http/mappers";
import type { AppEnv } from "../http/types";
import { parseDateQuery, parseUuid } from "../http/validation";

/** Rotas do funcionário. Tudo é filtrado pelo usuário da sessão. */
export function employeeRoutes(container: Container) {
  const app = new Hono<AppEnv>();
  const { conversations, tickets } = container;

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