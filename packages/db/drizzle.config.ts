import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile("../../.env");
} catch {
  // sem .env local: usa as variáveis do ambiente
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não definida");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});