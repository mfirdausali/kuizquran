// Make the test `env` carry our worker's bindings.
import type { Env } from "../src/env.ts";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {}
}
