import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dir = path.dirname(fileURLToPath(import.meta.url));

// The engine alias must be configured HERE too. tsconfig `paths` is a
// type-level fiction the test runner does not read — same reason next.config
// carries it for webpack/turbopack. Three resolvers, one alias, or the tests
// typecheck and then fail to run.
export default defineConfig({
  resolve: {
    alias: {
      "@engine": path.resolve(dir, "../../packages/engine/src"),
      "@": dir,
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
  },
});
