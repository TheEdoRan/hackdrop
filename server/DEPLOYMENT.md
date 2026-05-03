# Deployment

Hackdrop has two deployable units:

- `server/` — the **Hono API**, packaged as a Docker container. Deploy it anywhere that can run a container with HTTPS in front of it (any PaaS, container orchestrator, or plain Docker host behind a reverse proxy).
- `extension/` — the **browser extension**, packaged as a `.zip` and either side-loaded for personal use or submitted to the Chrome Web Store / Mozilla Add-ons.

This document is a recipe. It assumes you have a host that can run Docker containers and terminate TLS in front of them.

## 1. Deploy the API

The Hono server scrapes `github.com/trending` every 30 minutes and serves the cached JSON to the extension. It needs to be reachable on a stable HTTPS URL.

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
- `cache-control: public, s-maxage=1800, max-age=600, stale-while-revalidate=600` is emitted on every successful response — any CDN / edge cache in front of the server can hold the response for 30 min (matching the scrape cadence); the user's browser caches for 10 min, and serves stale for an additional 10 min while revalidating.
- The background scheduler refreshes the cache every 30 minutes whether anyone is hitting the endpoint or not.

### 1.5. Operational notes

- **Logs:** the server emits `pino` JSON in production. Tail with `docker compose logs -f server` (or wire your platform's log viewer to the container's stdout).
- **Scraper drift:** if GitHub changes their HTML and the parser starts returning fewer than 5 items, the server logs `parser_drift` at error level and **keeps serving the previous good cache**. Your dashboard stays alive while you ship a fix.
- **Updating:** from the repo root, `git pull && docker compose up -d --build`. Compose rebuilds the image, swaps the container in place, and the cache repopulates immediately on container start (the boot scrape is synchronous-ish).
- **Stopping / restarting:** `docker compose down` to stop, `docker compose restart server` to bounce without rebuilding.

## 2. Build and install the extension

### 2.1. Build

```bash
pnpm install               # from repo root, if you haven't already
pnpm --filter @hackdrop/extension build
```

This produces `extension/dist/` containing `manifest.json`, the bundled JS/CSS, fonts, and icons. The API URL is hardcoded — no environment configuration step.

### 2.2. Install — Chromium (Chrome / Edge / Brave / Arc / etc.)

1. Open `chrome://extensions` (or the equivalent for your browser).
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the `extension/dist/` directory.
4. Open a new tab — Hackdrop is now your new-tab page.

### 2.3. Install — Firefox

Firefox makes side-loaded MV3 extensions a bit fiddlier than Chromium because temporary add-ons clear themselves on browser restart. For personal use:

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `extension/dist/manifest.json`.
4. Open a new tab — Hackdrop is your new-tab page until you restart Firefox.

For a permanent Firefox install:

```bash
pnpm --filter @hackdrop/extension package
# → produces extension/web-ext-artifacts/hackdrop-0.1.0.zip
```

Submit that `.zip` to [addons.mozilla.org](https://addons.mozilla.org) under your developer account, or self-distribute via a signed `.xpi` (requires AMO sign-only flow).

## 3. Updating either component

| Change | What to redeploy |
|---|---|
| Edited `server/src/**` | From the repo root: `git pull && docker compose up -d --build`. |
| Bumped `server/package.json` deps | Same — compose rebuilds with the new lockfile. |
| Edited `extension/src/**` | Run `pnpm --filter @hackdrop/extension build` → reload the extension in the browser (Chromium: hit the reload icon on the extension card). |
| Changed the hardcoded API URL (in `fetch.ts` and `manifest.json`) | Rebuild → reload. |
| Changed `extension/public/manifest.json` | Rebuild → reload. |

## 4. Troubleshooting

**“The page shows ‘Couldn’t load’ in the GitHub column.”**
The API is unreachable. Hit `/health` on your deployed API. If that's down, check `docker compose logs server` for errors.

**“Stars today shows 0 for everything.”**
GitHub may be rendering the trending page in a slightly different way. Check the most recent `parser_drift` line in `docker compose logs server` and update `server/src/scrape.ts` to match the new HTML structure, then rerun `docker compose up -d --build`.

**“Theme isn’t following my OS.”**
Hackdrop reads `prefers-color-scheme` only — it has no toggle by design. If your browser is configured to override the system theme (some browsers have a “Force dark mode” setting), disable that override.

**“Hacker News is empty but trending works.”**
Hacker News is fetched directly from `hacker-news.firebaseio.com`. Open the browser DevTools network tab on the new-tab page; if those requests fail, the Firebase API may be temporarily down (very rare) or you're offline.
