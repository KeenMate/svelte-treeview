.PHONY: help setup dev install build build-all build-showcase test test-watch publish publish-dry docker-build docker-start docker-stop docker-restart

help: ## Show this help
	@echo ""
	@echo "  svelte-treeview"
	@echo "  ==============="
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

setup: install ## Alias for install

install: ## Install npm dependencies
	npm install

dev: ## Start dev server (port 17777)
	npm run dev

build: ## Build library only (svelte-package)
	npm run prepack

build-all: ## Build everything (showcase + library)
	npm run build

build-showcase: ## Build showcase site only
	npm run build:showcase

test: ## Run tests once
	npm run test:run

test-watch: ## Run tests in watch mode
	npm run test

publish: ## Publish to npm (TAG=rc for pre-release)
	npm publish $(if $(TAG),--tag $(TAG))

publish-dry: ## Dry-run publish (TAG=rc for pre-release)
	npm publish --dry-run $(if $(TAG),--tag $(TAG))

# Docker commands
docker-build: ## Build Docker image
	docker build --progress plain -t registry.km8.es/svelte-treeview-showcase:production .

docker-run: docker-build ## Build and run Docker container
	docker run -p 8080:80 --name svelte-treeview-showcase registry.km8.es/svelte-treeview-showcase:production

docker-stop: ## Stop and remove Docker container
	docker stop svelte-treeview-showcase || true
	docker rm svelte-treeview-showcase || true

docker-restart: docker-stop docker-start ## Restart Docker container