# iman.app — one command to run the thing.
#
# HARNESS-01. Before this file, starting the app meant reverse-engineering two
# npm projects and knowing that `composer dev` starts the WRONG Vite (the Laravel
# scaffold's, not the real SPA). See LOCAL-SETUP.md.

SHELL := /bin/bash
.DEFAULT_GOAL := help

V2      := v2
API     := v2/api
CORPUS_COMPILER := v3/packages/corpus-compiler
ENGINE  := v3/packages/engine

.PHONY: help setup dev dev-web dev-api test test-web test-api test-v3 build clean doctor golden-log compile-corpus

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n",$$1,$$2}'

setup: ## First run: install deps, create .env, key, migrate
	@command -v php >/dev/null || { echo "✗ php not found"; exit 1; }
	@command -v composer >/dev/null || { echo "✗ composer not found"; exit 1; }
	@command -v node >/dev/null || { echo "✗ node not found"; exit 1; }
	cd $(API) && composer install
	@# bootstrap/cache and storage/framework are gitignored — a fresh clone has
	@# neither, and `package:discover` fails cryptically without them.
	cd $(API) && mkdir -p bootstrap/cache storage/framework/{cache,sessions,views} storage/logs
	@[ -f $(API)/.env ] || (cp $(API)/.env.example $(API)/.env && echo "→ created $(API)/.env")
	@grep -q '^APP_KEY=base64' $(API)/.env || (cd $(API) && php artisan key:generate)
	cd $(API) && php artisan migrate --force
	cd $(V2) && npm install
	@[ -f $(V2)/.env ] || (cp $(V2)/.env.example $(V2)/.env && echo "→ created $(V2)/.env")
	cd $(CORPUS_COMPILER) && npm install
	cd $(ENGINE) && npm install
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

test: test-web test-api test-v3 ## Run every suite

test-web: ## vitest (v2)
	cd $(V2) && npm test

test-api: ## PHPUnit
	cd $(API) && php artisan test

test-v3: ## vitest (v3 packages: corpus-compiler, engine)
	cd $(CORPUS_COMPILER) && npm test
	cd $(ENGINE) && npm test

build: ## Type-check + build the SPA (must pass; see B9)
	cd $(V2) && npm run build

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

clean: ## Remove build output and caches
	rm -rf $(V2)/dist $(V2)/node_modules/.vite
	cd $(API) && php artisan optimize:clear

golden-log: ## Regenerate v3's golden log + oracle via v3's own engine (human-reviewed diff only — see v3/fixtures/golden-log/README.md)
	cd $(V2) && TZ=UTC node_modules/.bin/vite-node ../v3/scripts/gen-golden-log.ts

compile-corpus: ## Compile the v3 corpus for surahs 12, 103, 112 (build-plan step 3)
	cd $(CORPUS_COMPILER) && npm run compile -- 12
	cd $(CORPUS_COMPILER) && npm run compile -- 103
	cd $(CORPUS_COMPILER) && npm run compile -- 112
