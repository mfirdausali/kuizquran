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
  // JSX for the quiz component tests. `automatic` matches tsconfig's
  // `"jsx": "react-jsx"`, so the test runner and the typechecker compile the
  // same source the same way — a classic-vs-automatic mismatch here shows up
  // as "React is not defined" at run time only, long after tsc said clean.
  esbuild: {
    jsx: "automatic",
  },
  test: {
    // `node` STAYS THE DEFAULT. The 37 lib/idb tests and the 43 structural
    // shell tests are filesystem/IndexedDB tests that neither need nor want a
    // DOM, and jsdom is ~10x slower to start. The component tests opt IN
    // per-file with a `@vitest-environment jsdom` docblock — the narrowest
    // possible change, and it means a future non-DOM test in this directory
    // does not silently inherit a DOM it never asked for.
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "test/**/*.test.ts",
      // .tsx so the component tests can be written in JSX.
      "test/**/*.test.tsx",
    ],
    setupFiles: ["./test/setup.ts"],
  },
});
