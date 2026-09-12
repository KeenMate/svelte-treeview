.PHONY: help setup dev install build build-all build-showcase test test-watch test-e2e test-e2e-ui test-e2e-headed publish publish-rc publish-dry image-build image-run image-stop image-clean

# Per-developer overrides (container runner, image name, served port). Optional:
# the leading `-` means it's fine if the file is absent, and the `?=` defaults below
# apply when a value isn't set, so `image-*` works out of the box. Copy/edit
# .makefile.env to switch the runner (e.g. DOCKER_RUNNER = docker) or the port.
-include .makefile.env
DOCKER_RUNNER  ?= podman
IMAGE_NAME     ?= registry.km8.es/svelte-treeview-examples:prod
CONTAINER_NAME ?= svelte-treeview-examples
IMAGE_PORT     ?= 17780

help: ## Show this help
	@echo ""
	@echo "  svelte-treeview"
	@echo "  ==============="
	@echo ""
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
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

test-e2e: ## Run Playwright e2e tests (headless)
	npm run test:e2e

test-e2e-ui: ## Run Playwright e2e tests in UI mode
	npm run test:e2e:ui

test-e2e-headed: ## Run Playwright e2e tests headed
	npm run test:e2e:headed

publish: ## Publish to npm (TAG=rc for pre-release)
	npm publish $(if $(TAG),--tag $(TAG))

publish-rc: ## Publish pre-release to npm under the rc dist-tag
	npm publish --tag rc

publish-dry: ## Dry-run publish (TAG=rc for pre-release)
	npm publish --dry-run $(if $(TAG),--tag $(TAG))

# ── Container image (examples showcase) ──────────────────────────────────────
# Multi-stage build (Dockerfile): SvelteKit showcase → static build/ → nginx.
# Runner is configurable via .makefile.env (DOCKER_RUNNER); defaults to podman.

image-build: ## Build the examples showcase image (build + serve stages)
	@echo "Building $(IMAGE_NAME) with $(DOCKER_RUNNER)..."
	$(DOCKER_RUNNER) build -t $(IMAGE_NAME) .
	@echo "Image built: $(IMAGE_NAME)"

image-run: ## Run the showcase image (serves on IMAGE_PORT, default 17780)
	@echo "Starting $(CONTAINER_NAME) on http://localhost:$(IMAGE_PORT) ..."
	-@$(DOCKER_RUNNER) rm -f $(CONTAINER_NAME) >/dev/null 2>&1
	$(DOCKER_RUNNER) run -d --name $(CONTAINER_NAME) -p $(IMAGE_PORT):80 $(IMAGE_NAME)
	@echo "Serving examples at http://localhost:$(IMAGE_PORT)"

image-stop: ## Stop and remove the showcase container
	@echo "Stopping $(CONTAINER_NAME)..."
	-@$(DOCKER_RUNNER) rm -f $(CONTAINER_NAME) >/dev/null 2>&1
	@echo "Stopped"

image-clean: image-stop ## Remove the showcase container and image
	@echo "Removing image $(IMAGE_NAME)..."
	-@$(DOCKER_RUNNER) rmi $(IMAGE_NAME) >/dev/null 2>&1
	@echo "Image removed"