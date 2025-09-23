.PHONY: setup dev install build build-showcase test test-watch publish publish-dry docker-build docker-start docker-stop docker-restart

setup: install

install:
	npm install

dev:
	npm run dev

build:
	npm run build

build-showcase:
	npm run build:showcase

test:
	npm run test:run

test-watch:
	npm run test

publish:
	npm publish

publish-dry:
	npm publish --dry

# Docker commands
docker-build: ## Build Docker image
	docker build --progress plain -t registry.km8.es/svelte-treeview-showcase:production .

docker-run: docker-build ## Build and run Docker container
	docker run -p 8080:80 --name svelte-treeview-showcase registry.km8.es/svelte-treeview-showcase:production

docker-stop: ## Stop and remove Docker container
	docker stop svelte-treeview-showcase || true
	docker rm svelte-treeview-showcase || true

docker-restart: docker-stop docker-start