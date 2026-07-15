import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// v2-D01: React + Vite (NOT Next.js). Local-first client app; Laravel is a
// separate backend the app syncs to (it does not render this UI).
export default defineConfig({
  plugins: [react()],
  server: { port: 5273 },
});
