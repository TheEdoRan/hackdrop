# Server deployment

This document covers deploying the **Hono API** in `server/`. It's packaged as a Docker container and runs anywhere that can host a container with HTTPS in front of it (any PaaS, container orchestrator, or plain Docker host behind a reverse proxy).

For publishing the browser extension to the Chrome Web Store or Mozilla Add-ons, see [`extension/DEPLOYMENT.md`](../extension/DEPLOYMENT.md).

This document is a recipe. It assumes you have a host that can run Docker containers and terminate TLS in front of them.

## 1. Deploy the API

The Hono server scrapes `github.com/trending` every hour and serves the cached JSON to the extension. It needs to be reachable on a stable HTTPS URL.

### 1.1. Build context

The image is built from `server/Dockerfile`, but the **build context must be the repository root** — the Dockerfile copies `pnpm-lock.yaml` and `pnpm-workspace.yaml` from there. Never `cd server/ && docker build .`; that strips the workspace files out of scope and the build fails on the `COPY` lines.

Configure your platform with:

- **Build context / build path:** `.` (the repository root)
- **Dockerfile path:** `server/Dockerfile`
- **Exposed port:** `3000`
- **Healthcheck path:** `/health` (the container also defines a Docker `HEALTHCHECK` that hits this internally)

#### Compose (recommended for VPS)

A `docker-compose.yml` lives at the repo root with the build context, port binding, and restart policy already wired up. From the repo root on the VPS:

```bash
docker compose up -d --build
```

The port is bound to `127.0.0.1:3000` so only a reverse proxy on the same host can reach it. Redeploy after a `git pull` with the same command — compose rebuilds the image and replaces the container in one step.

#### Plain `docker build` / `docker run`

If you'd rather not use compose:

```bash
docker build -f server/Dockerfile -t hackdrop-server .
docker run -d \
  --name hackdrop-server \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  hackdrop-server
```

### 1.2. Environment variables

None are required. The server reads `PORT` (default `3000`) and `NODE_ENV` (set to `production` in the runtime image). Optionally set `LOG_LEVEL` if you want to filter `pino` output.

### 1.3. TLS and domain

Put the container behind a reverse proxy (Caddy, Traefik, nginx, or your platform's built-in router) that terminates TLS on a stable hostname. The extension hardcodes `https://hackdrop-api.theedoran.xyz` in `extension/src/sources/github-trending/fetch.ts` and `extension/public/manifest.json`. Change both if you deploy to a different host (and rebuild the extension after).

### 1.4. Verify

```bash
# Replace YOUR_API with the host you just configured.
export YOUR_API=https://your-api-domain

# Health check
curl -s "$YOUR_API/health" | jq
# → { "ok": true, "lastScrapeAt": "...", "lastScrapeStatus": "ok", "cacheKeys": ["daily:"], "parserVersion": 1 }

# Trending list
curl -s "$YOUR_API/v1/github?since=daily" | jq 'length'
# → number of repos (typically 5–25, depending on what GitHub serves)
```

Expected behavior:

- The first request after deploy may return `503 cache_warming` if it lands before the boot scrape completes (~2 seconds). After that, every request is served from RAM.
- `cache-control: public, s-maxage=3600, max-age=1800, stale-while-revalidate=1800` is emitted on every successful response — any CDN / edge cache in front of the server can hold the response for 1 h (matching the scrape cadence); the user's browser caches for 30 min, and serves stale for an additional 30 min while revalidating.
- The background scheduler refreshes the cache every hour whether anyone is hitting the endpoint or not.

### 1.5. Operational notes

- **Logs:** the server emits `pino` JSON in production. Tail with `docker compose logs -f server` (or wire your platform's log viewer to the container's stdout).
- **Scraper drift:** if GitHub changes their HTML and the parser starts returning fewer than 5 items, the server logs `parser_drift` at error level and **keeps serving the previous good cache**. Your dashboard stays alive while you ship a fix.
- **Stopping / restarting:** `docker compose down` to stop, `docker compose restart server` to bounce without rebuilding.

## 2. Updating

From the repo root:

```bash
git pull && docker compose up -d --build
```

Compose rebuilds the image (picking up any `server/src/**` or `server/package.json` changes), swaps the container in place, and the cache repopulates immediately on container start (the boot scrape is synchronous-ish).

## 3. Troubleshooting

**“The page shows ‘Couldn’t load’ in the GitHub column.”**
The API is unreachable. Hit `/health` on your deployed API. If that's down, check `docker compose logs server` for errors.

**“Stars today shows 0 for everything.”**
GitHub may be rendering the trending page in a slightly different way. Check the most recent `parser_drift` line in `docker compose logs server` and update `server/src/scrape.ts` to match the new HTML structure, then rerun `docker compose up -d --build`.
