# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

Hackdrop is a pnpm workspace with two packages:

- `extension/` — Preact + Vite + Tailwind v4 browser extension (MV3, dual-targets Chromium and Firefox from a single build).
- `server/` — Hono on Node 24, scrapes `github.com/trending` every hour and serves the cached JSON.

Node 24+ is required (`.nvmrc`, `engines.node: ">=24"`). pnpm 10.x is the package manager. Deployment recipe lives in `server/DEPLOYMENT.md`; a `docker-compose.yml` at the repo root is the canonical VPS workflow.

## Common commands

From the repo root:

| Command | Purpose |
|---|---|
| `pnpm install` | Install workspace deps. |
| `pnpm dev` | Run extension Vite dev server **and** Hono server in parallel (`-r --parallel --stream dev`). |
| `pnpm build` | Build both packages. |
| `pnpm lint` / `pnpm lint:fix` | oxlint with type-aware checks (see `.oxlintrc.json`). |
| `pnpm fmt` / `pnpm fmt:fix` | oxfmt (see `.oxfmtrc.json`). Tabs, double quotes, 120 cols, sorts imports + Tailwind classes. |

Per-package:

- `pnpm --filter @hackdrop/extension build` — runs `tsc --noEmit && vite build`. The API URL is hardcoded in `src/sources/github-trending/fetch.ts` and `public/manifest.json`; no env-based injection.
- `pnpm --filter @hackdrop/extension package` — produces a signed-ready `.zip` in `extension/web-ext-artifacts/` via `web-ext`.
- `pnpm --filter @hackdrop/extension typecheck` — `tsc --noEmit` only.
- `pnpm --filter @hackdrop/server dev` — `tsx watch src/server.ts`.
- `pnpm --filter @hackdrop/server build` — emits `server/dist/`. tsconfig uses `rewriteRelativeImportExtensions`, so source imports keep the `.ts` suffix and the compiler rewrites them to `.js` on emit.

There is **no test suite** in this repo; do not invent test commands.

## Commits

Always use [Conventional Commits](https://www.conventionalcommits.org/) format (`type(scope): subject`, e.g. `feat(server): add monthly trending endpoint`). Write the entire message in **lowercase**, including the subject and body. The only exception is service or commercial names that have a canonical capitalization — keep `GitHub`, `Hacker News`, `Firebase`, `Vite`, `Preact`, etc. in their proper case.

## Releases

`pnpm release <patch|minor|major|x.y.z>` (script: `scripts/release.mjs`) bumps the version in `extension/package.json`, `extension/public/manifest.json`, and root `package.json` in lockstep, promotes `CHANGELOG.md` `[Unreleased]` to `[X.Y.Z] - <today>`, commits as `chore(release): vX.Y.Z`, and tags `vX.Y.Z`. The script does not push — the operator runs `git push --follow-tags` afterward. Don't craft release commits or bump versions by hand; always go through the script.

Guards: refuses to run on a dirty tree, off `main`, on version drift between the three versioned files, if the tag exists, or if `[Unreleased]` has no content under any subsection (blank `### Added/Changed/Fixed` headings alone count as empty).

Pushing the `v*` tag triggers `.github/workflows/release.yml`, which runs `pnpm --filter @hackdrop/extension package`, extracts the matching `## [X.Y.Z]` body from `CHANGELOG.md` via `awk` into `release_notes.md`, and creates a GitHub Release with the zip attached and the section body as release notes. The workflow also accepts `workflow_dispatch` with a tag input as a manual fallback.

### Writing changelog entries

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Between releases, edit only the `## [Unreleased]` section at the top — the release script handles promotion and inserts a fresh empty `[Unreleased]`. Subsections used: **Added**, **Changed**, **Fixed**, **Removed**, **Security**. Empty subsections may stay.

Entries are **user-facing prose** in normal sentence case — written for someone wondering "what changed in this version?", not for someone reviewing the code. This is *unlike* commit messages (which are lowercase per Conventional Commits): the changelog is product-facing release notes and uses standard capitalization.

- Good: `Added a monthly view to the GitHub Trending column.` / `Fixed a flicker on first load with dark system theme.`
- Bad (commit-only material): refactors, dependency bumps without user impact, lint/format/CI tweaks, type cleanups — anything a user wouldn't notice.

Pick the SemVer bump deliberately: **patch** for bug fixes only, **minor** for new features, **major** for breaking changes (e.g. cached `hackdrop:`-namespaced storage shape changes that invalidate users' local data, or removal of a source).

## API URL

The deployed API at `https://hackdrop-api.theedoran.xyz` is hardcoded in two places:

- `extension/src/sources/github-trending/fetch.ts` — the `fetch()` target.
- `extension/public/manifest.json` — `host_permissions` (MV3 requires the host to be declared explicitly).

To point at a different server (e.g. a local one for testing), change both and rebuild + reload the extension. There is no `.env`, no `import.meta.env.VITE_*`, and no build-time injection step.

## Architecture

### Server: scrape → in-memory cache → HTTP

`server/src/server.ts` boots Hono on `:3000`, registers `SIGINT`/`SIGTERM` shutdown, and starts a scheduler.

- `cache.ts` — module-level `Map` cache keyed by `${since}:${language}`. `startScheduler()` runs the scrape immediately on boot and every hour. **On scrape failure (network error or `ParserDriftError`) the previous good cache is kept** and `lastScrapeStatus` flips to `"failed"`; the endpoint keeps serving stale data rather than 5xx-ing.
- `scrape.ts` — fetches `github.com/trending` with a 10s `AbortController` timeout, parses with cheerio. If fewer than `MIN_VALID_ITEM_COUNT` (5) items come out, it throws `ParserDriftError` so the cache layer knows GitHub's HTML probably changed. **When the scraper breaks, fix the selectors in `scrape.ts` — don't bypass the drift check.**
- `index.ts` — defines `/health` (no-store, returns scrape status + parser version) and `/v1/github?since=daily|weekly|monthly`. The `/v1/github` response sets `Cache-Control: public, s-maxage=3600, max-age=1800, stale-while-revalidate=1800` (CDN/edge caches for 1h, browser 30m + 30m SWR). Returns `503 cache_warming` only before the boot scrape lands.
- CORS is wide open (`origin: "*"`) since this is consumed by browser extensions from arbitrary origins.

`PARSER_VERSION` in `index.ts` is exposed via the `X-Hackdrop-Parser-Version` header and `/health`. Bump it whenever the scrape output shape changes so clients/observers can detect drift.

### Extension: source registry + per-source columns

Entry point: `extension/src/main.tsx` → `App.tsx`. Two columns are rendered (`ColumnCard`), one per registered source. Mobile shows a tab toggle (`SourceToggle`) with `lg:` breakpoint splitting into the side-by-side layout.

A **source** is anything matching `Source<TItem>` (`extension/src/sources/types.ts`):

```ts
type Source<TItem> = {
  id: SourceId; name: string; externalUrl: string; brand: "github" | "hn";
  cache: { key: string; ttlMs: number };
  fetch(signal: AbortSignal): Promise<TItem[]>;
  Item: ComponentType<{ item: TItem }>;
  Icon: ComponentType<{ className?: string }>;
};
```

Adding a new column means: create `extension/src/sources/<id>/` with `index.ts` (the `Source` object), `fetch.ts`, `Item.tsx`, `Icon.tsx`, `types.ts` — then register it in `App.tsx` (the `SOURCES` array and the rendered `ColumnCard`s). Brand colors live in Tailwind tokens.

`useSourceData(source)` (`lib/useSourceData.ts`) is the single hook that drives every column: read cache → render stale immediately → revalidate via `source.fetch(signal)` → write cache. Aborts on unmount.

`lib/cache.ts` picks `browser.storage.local` / `chrome.storage.local` when in an extension context and **falls back to `window.localStorage` for Vite dev** (so `pnpm dev` works without loading the unpacked extension). All keys are namespaced `hackdrop:`.

Two sources today:
- `github-trending` calls **the Hono server** (`/v1/github?since=daily`).
- `hacker-news` calls **the Firebase API directly** (`hacker-news.firebaseio.com/v0`) — no proxy, no scrape. Hence the `host_permissions` entry for `hacker-news.firebaseio.com` in `manifest.json`.

### MV3 manifest

`extension/public/manifest.json` is the single source of truth (Vite copies `public/` into `dist/` verbatim). It targets both Chromium and Firefox via `browser_specific_settings.gecko`. `host_permissions` hardcodes the deployed API host alongside the Hacker News Firebase host.

Vite is configured (`vite.config.ts`) with `root = src/`, single rollup input `src/index.html` (the new-tab page). Tailwind v4 is wired via `@tailwindcss/vite` — there is no PostCSS config and no `tailwind.config.{js,ts}`; tokens and theme are defined in `src/styles/app.css`.

### TypeScript / JSX specifics

- **Preact, not React.** `tsconfig.json` sets `jsxImportSource: "preact"` and aliases `react`/`react-dom` to `preact/compat` so any libraries expecting React Just Work.
- `verbatimModuleSyntax: true` in both packages — always use `import type` for type-only imports (oxlint enforces this via `typescript/consistent-type-imports: error`).
- `noUncheckedIndexedAccess: true` everywhere — array/object index access yields `T | undefined`.
- Extension imports omit extensions (`./App`); server imports keep `.ts` and rely on `rewriteRelativeImportExtensions`. Do not mix the two conventions.
- Browser extension globals: `@types/chrome` and `@types/firefox-webext-browser` are both loaded; expect both `chrome` and `browser` to exist at runtime in different browsers.

### Style & lint

- Oxfmt (`.oxfmtrc.json`): tabs (2-wide), double quotes, semis, trailing comma `es5`, 120-col print width. Imports and Tailwind class lists are auto-sorted on format.
- Oxlint (`.oxlintrc.json`): type-aware mode is **on** (`typeAware`, `typeCheck`). Plugins: `oxc, eslint, unicorn, typescript, react, react-perf`. `correctness` errors, `suspicious` warns. Notably overridden: `eslint/no-shadow: off`, `typescript/no-unsafe-type-assertion: off`, `unicorn/prefer-node-protocol: error` (use `node:fs`, `node:path`, etc.).

## Deployment notes

- Server is built from a multi-stage `server/Dockerfile`. **Build context must be the repo root** (the Dockerfile copies `pnpm-lock.yaml` and `pnpm-workspace.yaml`). Whatever PaaS or orchestrator you use, configure the build path as `.` and the Dockerfile path as `server/Dockerfile`.
- The `extension/package.json` is also copied into the Docker image purely so pnpm recognizes the workspace shape — `--filter @hackdrop/server...` ensures only server deps are installed.
- Runtime healthcheck hits `/health` via `wget` inside the container.

For the full deployment recipe, edit `server/DEPLOYMENT.md`. The repo-root `docker-compose.yml` is the canonical way to run the container — its build context must stay at `.` because `server/Dockerfile` copies `pnpm-lock.yaml` and `pnpm-workspace.yaml` from the workspace root.
