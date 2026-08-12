<?php

return [
    /*
     * Where the TS corpus-compiler package lives, and which node binary
     * runs its `.ts` entrypoints directly (`--experimental-strip-types`,
     * the same invocation `compile-corpus` already uses — no ts-node/vite-
     * node dependency needed for a single-file script).
     *
     * `base_path()` here is v3/api, so the default resolves to
     * v3/packages/corpus-compiler. A deployed host laying the tree out
     * differently overrides via CORPUS_COMPILER_PATH rather than by
     * patching code — same convention as config/nightly.php's
     * fold_runner_path.
     */
    'compiler_path' => env('CORPUS_COMPILER_PATH', base_path('../packages/corpus-compiler')),

    'node_bin' => env('CORPUS_NODE_BIN', 'node'),
];
