import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    testing: "src/testing.ts",
    migrate: "src/migrate.ts",
    seed: "src/seed/index.ts",
    bootstrap: "src/bootstrap.ts",
  },
  format: ["esm"],
  dts: { entry: { index: "src/index.ts", testing: "src/testing.ts" } },
  clean: true,
  sourcemap: true,
  target: "es2022",
});