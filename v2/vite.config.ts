import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// v2-D01: React + Vite (NOT Next.js). Local-first client app; Laravel is a
// separate backend the app syncs to (it does not render this UI).
//
// "engine" alias: packages/engine is ported vendored-in-app (src/engine/src),
// not a pnpm workspace package (v2 is a single npm app, not a monorepo) — see
// the engine-placement decision in DECISIONS.md. The alias lets every ported
// file's `import ... from "engine"` resolve unchanged, exactly as v1's pnpm
// workspace `engine` package did.
export default defineConfig({
  plugins: [react()],
  server: { port: 5273 },
  resolve: {
    alias: {
      engine: fileURLToPath(new URL("./src/engine/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
