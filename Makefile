# iman.app — one command to run the thing.
#
# HARNESS-01. Before this file, starting the app meant reverse-engineering two
# npm projects and knowing that `composer dev` starts the WRONG Vite (the Laravel
# scaffold's, not the real SPA). See LOCAL-SETUP.md.

SHELL := /bin/bash
.DEFAULT_GOAL := help

V2      := v2
API     := v2/api
API_V3  := v3/api
CORPUS_COMPILER := v3/packages/corpus-compiler
ENGINE  := v3/packages/engine
FOLD_RUNNER := v3/worker/fold-runner
WEB_V3  := v3/apps/web

.PHONY: help setup dev dev-web dev-api dev-api3 test test-web test-api test-api3 test-v3 typecheck-v3 build clean doctor golden-log selection-log compile-corpus content-freeze distractor-qa determinism-check nightly-window

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n",$$1,$$2}'

setup: ## First run: install deps, create .env, key, migrate
	@command -v php >/dev/null || { echo "✗ php not found"; exit 1; }
	@command -v composer >/dev/null || { echo "✗ composer not found"; exit 1; }
	@command -v node >/dev/null || { echo "✗ node not found"; exit 1; }
	@# bootstrap/cache and storage/framework are gitignored — a fresh clone has
	@# neither, and composer's post-autoload-dump `package:discover` step fails
	@# cryptically without them. Create them BEFORE `composer install`, not
	@# after — composer runs `package:discover` as part of install itself, so
	@# creating the directory afterwards never actually helps a fresh clone.
	cd $(API) && mkdir -p bootstrap/cache storage/framework/{cache,sessions,views} storage/logs
	cd $(API) && composer install
	@[ -f $(API)/.env ] || (cp $(API)/.env.example $(API)/.env && echo "→ created $(API)/.env")
	@grep -q '^APP_KEY=base64' $(API)/.env || (cd $(API) && php artisan key:generate)
	cd $(API) && php artisan migrate --force
	cd $(V2) && npm install
	@[ -f $(V2)/.env ] || (cp $(V2)/.env.example $(V2)/.env && echo "→ created $(V2)/.env")
	@# v3-D08: v3's own Laravel app, separate from v2/api above (build-plan step 13).
	cd $(API_V3) && mkdir -p bootstrap/cache storage/framework/{cache,sessions,views} storage/logs
	cd $(API_V3) && composer install
	@[ -f $(API_V3)/.env ] || (cp $(API_V3)/.env.example $(API_V3)/.env && echo "→ created $(API_V3)/.env")
	@grep -q '^APP_KEY=base64' $(API_V3)/.env || (cd $(API_V3) && php artisan key:generate)
	cd $(API_V3) && php artisan migrate --force
	cd $(CORPUS_COMPILER) && npm install
	cd $(ENGINE) && npm install
	cd $(FOLD_RUNNER) && npm install
	cd $(WEB_V3) && npm install
	@echo ""
	@echo "✓ setup complete. Run: make dev"

dev: ## Run BOTH services (SPA :5273, API :8000)
	@command -v npx >/dev/null || { echo "✗ npx not found"; exit 1; }
	npx --yes concurrently --kill-others --names "api,web" -c "magenta,cyan" \
		"cd $(API) && php artisan serve --port=8000" \
		"cd $(V2) && npm run dev"

dev-web: ## Run only the SPA (:5273)
	cd $(V2) && npm run dev

dev-api: ## Run only the API (:8000)
	cd $(API) && php artisan serve --port=8000

dev-api3: ## Run only v3's API (:8001) — no frontend consumes it yet (M5)
	cd $(API_V3) && php artisan serve --port=8001

test: test-web test-api test-api3 test-v3 ## Run every suite

test-web: ## vitest (v2)
	cd $(V2) && npm test

test-api: ## PHPUnit (v2/api)
	cd $(API) && php artisan test

test-api3: compile-corpus ## PHPUnit (v3/api — build-plan step 13)
	@# v3-D77 fixed this gap for test-v3/build but missed this target:
	@# OverrideHashRecomputeTest (DEFECTS.md#B3's live-wiring closure) reads
	@# packages/corpus-compiler/output/112/hashes.json directly — no
	@# hand-seeded fixture substitutes for it (deliberately: the whole point
	@# is proving the recompute against the REAL compiled artifact). Without
	@# this dependency, `test-api3` run before `test-v3` in `test`'s own
	@# prerequisite list — or standalone, as `make test-api3` — failed on a
	@# genuinely clean checkout with no output/ yet. Reproduced by hand: `rm
	@# -rf packages/corpus-compiler/output && make test-api3` before this fix.
	cd $(API_V3) && php artisan test

test-v3: typecheck-v3 compile-corpus ## vitest (v3 packages: corpus-compiler, engine, worker/fold-runner, apps/web)
	cd $(CORPUS_COMPILER) && npm test
	cd $(ENGINE) && npm test
	cd $(FOLD_RUNNER) && npm test
	cd $(WEB_V3) && npm test

typecheck-v3: ## tsc --noEmit across the v3 node packages
	@# Until 2026-08-11 none of these packages depended on `typescript`, so
	@# `npx tsc` silently resolved to macOS's TeX `tsc` and exited 0 without
	@# typechecking ANYTHING — every "typecheck clean" claim before that date
	@# was a false pass. `typescript` is now a real devDependency in each
	@# package; keep it that way, and keep this target wired into test-v3 so
	@# a type error fails the suite instead of hiding.
	cd $(CORPUS_COMPILER) && npm run -s typecheck
	cd $(ENGINE) && npm run -s typecheck
	cd $(FOLD_RUNNER) && npm run -s typecheck
	@# apps/web must be here too, or it becomes the fourth package whose
	@# typecheck never ran. Verify `npx tsc --version` prints a TypeScript
	@# version there, not a TeX message.
	cd $(WEB_V3) && npm run -s typecheck

build: compile-corpus ## Type-check + build the SPA and the v3 web app (must pass; see B9)
	cd $(V2) && npm run build
	@# Runs the prebuild gates too: locked-CSS byte-diff, font presence, and
	@# the IDB/RSC + sacred-text boundary greps.
	cd $(WEB_V3) && npm run build

doctor: ## Check the harness is sane
	@echo "node    $$(node -v 2>/dev/null || echo MISSING)"
	@echo "php     $$(php -v 2>/dev/null | head -1 || echo MISSING)"
	@echo "composer $$(composer -V 2>/dev/null || echo MISSING)"
	@[ -f $(API)/.env ] && echo "api/.env ✓" || echo "api/.env ✗  — run make setup"
	@[ -f $(V2)/.env ] && echo "v2/.env  ✓" || echo "v2/.env  ✗  — run make setup"
	@grep -q '^APP_KEY=base64' $(API)/.env 2>/dev/null \
		&& echo "APP_KEY  ✓" || echo "APP_KEY  ✗  — run make setup"
	@grep -q '^ADMIN_EMAILS=' $(API)/.env 2>/dev/null \
		&& echo "ADMIN_EMAILS ✓" || echo "ADMIN_EMAILS ✗ — admin console will 403"
	@[ -f $(API_V3)/.env ] && echo "v3/api/.env ✓" || echo "v3/api/.env ✗  — run make setup"
	@grep -q '^APP_KEY=base64' $(API_V3)/.env 2>/dev/null \
		&& echo "v3/api APP_KEY  ✓" || echo "v3/api APP_KEY  ✗  — run make setup"

clean: ## Remove build output and caches
	rm -rf $(V2)/dist $(V2)/node_modules/.vite
	cd $(API) && php artisan optimize:clear
	cd $(API_V3) && php artisan optimize:clear

golden-log: ## Regenerate v3's golden log + oracle via v3's own engine (human-reviewed diff only — see v3/fixtures/golden-log/README.md)
	cd $(V2) && TZ=UTC node_modules/.bin/vite-node ../v3/scripts/gen-golden-log.ts

selection-log: ## Regenerate the selection-check log fixture (v3/fixtures/selection-log — see the script header)
	cd $(V2) && TZ=UTC node_modules/.bin/vite-node ../v3/scripts/gen-selection-log.ts

determinism-check: ## Run BOTH determinism checks on demand against committed fixtures (no DB needed) — proves the nightly works without waiting a night
	@# BUILD-PLAN's gates: fold_determinism_check "runs nightly + in CI against
	@# the shuffled golden log". This target is the CI half. Exit code carries
	@# the verdict: 0 green/warn, non-zero p1/error.
	cd $(FOLD_RUNNER) && node_modules/.bin/vite-node bin/fold-determinism-check.ts -- --fixture
	cd $(FOLD_RUNNER) && node_modules/.bin/vite-node bin/selection-determinism-check.ts

nightly-window: ## Report the 7-consecutive-green-nights streak with its evidence (exit 0 only when satisfied)
	cd $(API_V3) && TZ=UTC php artisan nightly:window

compile-corpus: ## Compile the v3 corpus for the launch set 12, 67, 103, 112 (build-plan steps 3 + Q3/v3-D59)
	cd $(CORPUS_COMPILER) && npm run compile -- 12
	cd $(CORPUS_COMPILER) && npm run compile -- 67
	cd $(CORPUS_COMPILER) && npm run compile -- 103
	cd $(CORPUS_COMPILER) && npm run compile -- 112

# ---- M9 content ops (build-plan steps 27 & 28) ----
# These are the ENGINEERING half. The hours they govern are human: a qari's
# calendar and a reviewer's judgement. `content-freeze` exits NON-ZERO until
# every M9 entry criterion is met — that exit code is what makes booking a
# scholar against an unfrozen corpus a visible mistake rather than a silent one.
content-freeze: ## M9 GATE: report each content-freeze criterion MET/NOT MET (exit 1 = do NOT book the qari)
	@node v3/scripts/content-freeze.mjs

distractor-qa: ## M9: 10% distractor QA sample for one surah (SURAH=112 [PCT=10] [WRITE=1])
	@node v3/scripts/distractor-qa.mjs --surah $(or $(SURAH),112) --pct $(or $(PCT),10) $(if $(WRITE),--write,)
