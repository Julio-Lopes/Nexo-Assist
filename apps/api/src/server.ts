import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { getContainer } from "./context";

try {
  process.loadEnvFile("../../.env");
} catch {
  // em container ou produção, as variáveis vêm do ambiente
}

const container = getContainer();
const app = createApp(container);

serve({ fetch: app.fetch, port: container.env.PORT }, (info) => {
  console.log(`API do Nexo Assist em http://localhost:${info.port}`);
});