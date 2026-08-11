// v3 web app — Next.js config.
//
// Plan §A3/§A4. Two things here are load-bearing and must not be "tidied away":
//
//  1. THE ENGINE ALIAS. There is no npm workspace at the repo root (verified:
//     no /package.json, no pnpm-workspace.yaml), so `v3-engine` is NOT resolvable
//     as a bare specifier — there is no node_modules/v3-engine. Introducing a root
//     workspace would restructure three already-green packages and their lockfiles,
//     and BUILD-PLAN reserves lockfile changes to the spine lane. So the engine is
//     reached by path alias instead. tsconfig `paths` handles the TYPE side; the
//     bundler does not read tsconfig paths, so it must be told separately — here.
//     Both webpack AND turbopack are configured: `next build` uses webpack (we
//     scaffolded --no-turbopack) but `next dev` defaults to turbopack in Next 16,
//     and an alias that works in one but not the other is a trap for the next agent.
//
//  2. Paths resolve from import.meta.url, NOT process.cwd(). cwd differs between
//     `next dev`, `next build`, and CI invoking the build from the repo root.

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** v3/apps/web/../../packages/engine/src/index.ts */
const ENGINE_ENTRY = path.resolve(__dirname, "../../packages/engine/src/index.ts");
const ENGINE_SRC = path.resolve(__dirname, "../../packages/engine/src");
/** v3/ — the tracing root. */
const V3_ROOT = path.resolve(__dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Next warns (and can mis-trace) when it detects multiple lockfiles above the
  // app dir — v3/packages/*/package-lock.json are all above apps/web in the walk.
  outputFileTracingRoot: V3_ROOT,

  // NO `output: "export"`. /library and /surah/[id] are content-shaped and benefit
  // from RSC + static generation of corpus data; a static export forecloses that
  // and the M6 sync/auth work. (Plan §A4.)

  turbopack: {
    resolveAlias: {
      "@engine": ENGINE_ENTRY,
    },
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@engine$": ENGINE_ENTRY,
      "@engine": ENGINE_SRC,
    };
    // The engine's sources import each other with explicit `.ts` extensions
    // (`import type { Face } from "./faces.ts"`), which is legal only under
    // allowImportingTsExtensions. Webpack must be told that a request ending in
    // `.ts` resolves to itself, or those intra-engine imports 404 at bundle time.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
