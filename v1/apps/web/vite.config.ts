import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// PWA is handled by a hand-written service worker (src/sw.ts → public/sw.js at
// build) rather than a plugin, to keep the dependency surface minimal per the
// locked stack. The corpus.json + shell are precached for offline drills.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
