.PHONY: setup dev install build publish publish-dry

setup: install

install:
	npm install

dev:
	npm run dev

build:
	npm run build

publish:
	npm publish

publish-dry:
	npm publish --dry