import type { NextConfig } from "next";

try {
  // Em desenvolvimento usa o .env da raiz do monorepo. Na Vercel, as variáveis vêm do projeto.
  process.loadEnvFile("../../.env");
} catch {
  // sem .env local
}

const config: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  },
};

export default config;