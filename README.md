<p align="center">
	<img src="./assets/hackdrop.png" alt="Hackdrop" width="160" height="160" />
</p>

<h1 align="center">Hackdrop</h1>

<p align="center">
	A modern new-tab browser extension that drops <strong>GitHub Trending</strong> and <strong>Hacker News</strong> into every new tab — side by side, theme-aware, zero configuration.
</p>

---

## Features

- **Two clean columns** — GitHub Trending (daily) on one side, Hacker News top stories on the other.
- **Auto theme** — follows your browser's `prefers-color-scheme`. No toggle, no flash on load.
- **Cross-browser** — single MV3 build targets both Chromium and Firefox.
- **Fast and stale-while-revalidate** — cached results render instantly, then refresh in the background.
- **No tracking, no accounts, no settings page.**

## Repository layout

```
hackdrop/
├── extension/   # Vite + Preact + Tailwind v4 browser extension (MV3, dual-target)
└── server/      # Hono + Node 24 API that proxies GitHub Trending (hourly scrape) and Hacker News
```

The `server/` is intended to run as a Docker container reachable at a stable URL. The `extension/` calls it for both GitHub Trending and Hacker News data; the browser doesn't talk to any third-party APIs directly.

## Quick start

Requires Node 24+ and pnpm 10.x.

```bash
pnpm install
pnpm dev   # runs both the extension Vite dev server and the Hono server in parallel
```

The extension is hardcoded to call the deployed API at `https://hackdrop-api.theedoran.xyz`. To point it at a local server, change `API_URL` in `extension/src/sources/github-trending/fetch.ts` (and `host_permissions` in `extension/public/manifest.json` if the host changes).

## Loading the extension

- **Chromium:** `pnpm --filter @hackdrop/extension build`, then load `extension/dist/` unpacked at `chrome://extensions`.
- **Firefox:** `pnpm --filter @hackdrop/extension build`, then go to `about:debugging` → *This Firefox* → *Load Temporary Add-on* → pick `extension/dist/manifest.json`.

For a signing-ready zip, run `pnpm --filter @hackdrop/extension package` (output lands in `extension/web-ext-artifacts/`).

## Deployment

The server ships as a multi-stage Docker image (`server/Dockerfile`), built from the **repo root** as build context. A `docker-compose.yml` at the repo root wires up the build, port binding, and restart policy — `docker compose up -d --build` is the one-line deploy. See [`server/DEPLOYMENT.md`](./server/DEPLOYMENT.md) for the full recipe.

## Why "Hackdrop"

Your daily drop of hacker content, in every new tab.

## Credits

Hackdrop is heavily inspired by the wonderful [Devo](https://github.com/karakanb/devo) extension — all credit to its author for the original idea and design language. Hackdrop is a from-scratch reimplementation with a different content mix and a server-side scraper for trending data.
