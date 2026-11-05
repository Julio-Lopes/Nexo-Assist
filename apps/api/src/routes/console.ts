import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import type { Container } from "../context";
import { CONSOLE_FILTERS } from "../conversations/conversation-service";
import { ApiError } from "../http/errors";
import { toConversation, toMessage, toUser } from "../http/mappers";
import type { AppEnv } from "../http/types";
import { parseJson, parseUuid } from "../http/validation";

const filterSchema = z.enum(CONSOLE_FILTERS).catch("for_you");
const messageSchema = z.object({ content: z.string().trim().min(1).max(2000) });

/** Console do analista (Telas 4 e 5). */
export function consoleRoutes(container: Container) {
  const app = new Hono<AppEnv>();
  const { conversations, tickets } = container;

  app.use("*", requireAuth(container), requireRole("analyst"));

  app.get("/conversations", async (c) => {
    const filter = filterSchema.parse(c.req.query("filter"));
    const list = await conversations.listForConsole(filter, c.get("user").id);

    return c.json({
      filter,
      counts: list.counts,
      items: list.items.map((item) => ({
        conversation: toConversation(item.conversation),
        employee: item.employee,
        lastMessage: item.lastMessage ? toMessage(item.lastMessage) : null,
      })),
    });
  });

  app.get("/conversations/:id", async (c) => {
    const id = parseUuid(c.req.param("id"));
    const { conversation, employee } = await conversations.getWithEmployee(id);

    const [history, employeeTickets] = await Promise.all([
      conversations.listMessages(id),
      tickets.listForRequester(employee.id, { includeClosed: true }),
    ]);

    return c.json({
      conversation: toConversation(conversation),
      employee: toUser(employee),
      messages: history.map(toMessage),
      tickets: employeeTickets,
    });
  });

  app.post("/conversations/:id/take", async (c) => {
    const updated = await conversations.take(parseUuid(c.req.param("id")), c.get("user"));
    return c.json({ conversation: toConversation(updated) });
  });

  app.post("/conversations/:id/release", async (c) => {
    const updated = await conversations.release(parseUuid(c.req.param("id")), c.get("user"));
    return c.json({ conversation: toConversation(updated) });
  });

  app.post("/conversations/:id/close", async (c) => {
    const updated = await conversations.close(parseUuid(c.req.param("id")), c.get("user"));
    return c.json({ conversation: toConversation(updated) });
  });

  app.post("/conversations/:id/messages", async (c) => {
    const id = parseUuid(c.req.param("id"));
    const user = c.get("user");
    const { content } = await parseJson(c, messageSchema);

    const { conversation } = await conversations.getWithEmployee(id);
    if (conversation.status !== "with_human" || conversation.assignedAnalystId !== user.id) {
      throw new ApiError(409, "conflict", "Assuma o atendimento para responder.");
    }

    const message = await conversations.appendMessage({
      conversationId: id,
      author: "analyst",
      authorId: user.id,
      authorName: user.name,
      content,
    });

    return c.json({ message: toMessage(message) }, 201);
  });

  return app;
}