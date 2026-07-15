import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          // Secrets aren't read from .dev.vars in the test pool — provide them.
          bindings: {
            SESSION_SECRET: "test-session-secret-abcdefghijklmnop",
            GOOGLE_CLIENT_ID: "test-client-id",
            ADMIN_EMAILS: "admin@example.com",
          },
        },
      },
    },
  },
});
