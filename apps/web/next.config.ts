import path from "node:path";
import type { NextConfig } from "next";

try {
  // Em desenvolvimento usa o .env da raiz do monorepo. Na Vercel, as variáveis vêm do projeto.
  process.loadEnvFile("../../.env");
} catch {
  // sem .env local
}

const config: NextConfig = {
  reactStrictMode: true,
  // Na imagem Docker o Next gera um servidor mínimo; na Vercel isso não é usado.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  },
};

export default config;