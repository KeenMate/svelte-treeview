# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — build: SvelteKit showcase → static site in build/ (adapter-static)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app

# @playwright/test is a devDependency; the image only builds the static site and
# never runs e2e, so skip its browser download to keep this layer small and fast.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install against the committed lockfile first so this layer caches until deps
# actually change. All dependencies resolve from the npm registry (no local
# file:/link: paths), so `npm ci` works inside the clean build context.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Bring in the source and build ONLY the showcase (vite build → build/). We skip
# the library packaging (prepack: svelte-package / lightningcss / publint) — it's
# irrelevant to serving the examples site. generate-constants stamps the real
# package version into src/lib/constants.generated.ts (the landing page reads it),
# so the version badge is baked in with no post-build patching. Everything the
# build touches (src/, static/, svelte.config.js, vite.config.ts, scripts/) comes
# in here; host node_modules/, build/ and dist/ are excluded via .dockerignore.
COPY . .
RUN npm run generate-constants && npm run build:showcase

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — serve: static examples site via nginx
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:alpine AS serve

# Replace the stock server block with one that serves the SvelteKit static output
# (prerendered *.html + hashed _app/ assets + static files like examples-shared.css)
# and silently drops vulnerability-scanner traffic (see nginx.conf).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# adapter-static wrote the whole site to build/: index.html is the SPA fallback for
# client-only routes, and every example page is also prerendered to <route>.html.
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
