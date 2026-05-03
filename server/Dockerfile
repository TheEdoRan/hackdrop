# syntax=docker/dockerfile:1.7
#
# Build context: repository root (so the workspace lockfile is in scope).

FROM node:24-alpine AS base
RUN npm i -g pnpm@10
WORKDIR /app

# --- All workspace deps for build ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
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
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
# extension/package.json is required for pnpm to recognize the workspace shape
# (the source isn't copied — `--filter @hackdrop/server...` only installs server deps).
COPY extension/package.json ./extension/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @hackdrop/server...

# --- Runtime ---
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
RUN addgroup -S app && adduser -S app -G app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/dist ./server/dist
COPY server/package.json ./server/
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD wget -qO- http://127.0.0.1:3000/health >/dev/null 2>&1 || exit 1
CMD ["node", "server/dist/server.js"]
