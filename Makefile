.DEFAULT_GOAL := help
SHELL := /bin/bash

.PHONY: help install dev build test typecheck lint format eval \
        db-generate db-migrate db-studio vercel-dev vercel-deploy clean

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install all workspace deps
	pnpm install --frozen-lockfile

dev: ## Start the Next.js dev server (web app + inline API workers)
	pnpm web

build: ## Build all packages and the web app
	pnpm build

test: ## Run unit + integration + e2e tests
	pnpm test

typecheck: ## Strict TypeScript typecheck across the monorepo
	pnpm typecheck

lint: ## Lint all packages
	pnpm lint

format: ## Format all source files with Prettier
	pnpm format

eval: ## Run the vision accuracy eval harness against the fixture suite
	pnpm eval

db-generate: ## Generate Drizzle migrations from the schema
	pnpm db:generate

db-migrate: ## Apply pending Drizzle migrations to the database
	pnpm db:migrate

db-studio: ## Open Drizzle Studio (local DB browser)
	pnpm db:studio

vercel-dev: ## Run the app against Vercel's dev runtime (emulates prod routing + env)
	pnpm --filter @prism/web exec vercel dev

vercel-deploy: ## Deploy to Vercel (preview)
	pnpm --filter @prism/web exec vercel deploy

clean: ## Remove build artifacts and node_modules
	pnpm clean
