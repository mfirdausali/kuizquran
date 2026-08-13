// The engine version this build folds under. Bump deliberately when engine
// semantics change — that bump is what turns a post-deploy divergence into a
// WARN instead of a 3am page (severity.ts's taxonomy).
//
// Lives here, not in bin/fold-determinism-check.ts, because a `bin/*.ts` file
// ends in `process.exit(main())` at module scope — importing one FOR a named
// export also runs its side-effecting CLI entrypoint, which reads (and
// consumes) stdin and calls `process.exit()` before the importing script's
// own logic ever runs. bin/rebuild-atom-cache.ts needs this constant too and
// hit exactly that bug on its first run: importing it from
// fold-determinism-check.ts silently executed THAT script's `main()`
// instead of its own.
export const ENGINE_VERSION = "v3-engine-0.1.0";
