# syntax=docker/dockerfile:1.7
#
# Build context: repository root (so the workspace lockfile is in scope).

# node:24-alpine — pinned by digest to neutralize tag drift.
# Refresh manually: `docker pull node:24-alpine && docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine`
FROM node:24-alpine@sha256:d1b3b4da11eefd5941e7f0b9cf17783fc99d9c6fc34884a665f40a06dbdfc94f AS base
RUN npm i -g pnpm@10
WORKDIR /app

# --- All workspace deps for build ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY server/package.json ./server/
# extension/package.json is required for pnpm to recognize the workspace shape
# (the source isn't copied — `--filter @hackdrop/server...` only installs server deps).
COPY extension/package.json ./extension/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @hackdrop/server...

# --- Compile TypeScript ---
FROM base AS build
COPY --from=deps /app /app
COPY server/ ./server/
RUN pnpm --filter @hackdrop/server build

# --- Prod-only deps for runtime ---
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY server/package.json ./server/
COPY extension/package.json ./extension/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @hackdrop/server...

# --- Runtime ---
FROM node:24-alpine@sha256:d1b3b4da11eefd5941e7f0b9cf17783fc99d9c6fc34884a665f40a06dbdfc94f AS runtime
WORKDIR /app
# server.ts defaults HOST to 127.0.0.1 so a stray local run doesn't expose
# the port; inside the container we want it bound on all interfaces so the
# proxy network can reach it.
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=prod-deps --chown=app:app /app/server/node_modules ./server/node_modules
COPY --from=build --chown=app:app /app/server/dist ./server/dist
COPY --chown=app:app server/package.json ./server/
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD wget -qO- http://127.0.0.1:3000/health >/dev/null 2>&1 || exit 1
CMD ["node", "server/dist/server.js"]
