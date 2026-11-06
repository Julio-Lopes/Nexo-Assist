import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Os testes de integração compartilham o mesmo banco: um arquivo por vez.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});