# Hacker News Server-Side Fetch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Hacker News data fetching from the extension (which fans out 31 requests to Firebase from every browser) into the Hackdrop server, so it's edge-cached behind Cloudflare and survives transient HN API failures.

**Architecture:** New on-demand server endpoint `/v1/hackernews` with a 60s in-memory cache, single-flight dedup, and last-good-on-failure semantics (mirroring the existing GitHub flow's defense-in-depth, but on-demand instead of scheduled because HN top stories rotate every few minutes). The extension swaps its 31-request fan-out for one GET against the new endpoint, drops the Firebase host permission, shortens its local cache TTL to match the server, and gains a proper empty-state UI plus a guard against caching empty responses.

**Tech Stack:** Hono (server), Preact + Vite (extension), Node 24, pnpm workspaces. No test framework in this repo (per CLAUDE.md) — verification is typecheck + manual `curl` / browser probes.

**Caching layers (for context — implemented across the tasks):**

| Layer | TTL / behavior | Why |
|---|---|---|
| Server in-memory (`hnCache.ts`) | 60s fresh; serves stale on refresh failure; single-flight dedup | One Firebase fan-out per minute max; survives upstream wobbles |
| HTTP `Cache-Control` header on `/v1/hackernews` | `public, s-maxage=60, max-age=30, stale-while-revalidate=120` | Edge holds fresh 60s; SWR avoids user-visible blocking refreshes |
| Cloudflare edge | Driven by `s-maxage` above | Most user requests never reach origin |
| Extension storage (`hackdrop:hacker-news`) | 60s; never write empty results | Instant first paint via stored stale data; doesn't poison cache on bad response |

---

## File Structure

**Server — new files:**
- `server/src/hackernews.ts` — Firebase API fetcher: top-story IDs + 30 parallel item fetches with per-request timeout, validation, transform to `HnStory`, min-count guard via `HnFetchError`. Pure function, no caching.
- `server/src/hnCache.ts` — Module-level on-demand cache. Single-flight dedup, 60s TTL, returns stale immediately while refreshing in background, keeps last-good on failure. Exposes `getHackerNews()` and `snapshotHn()`.

**Server — modified files:**
- `server/src/types.ts` — Add `HnStory` and `HnCacheEntry` types.
- `server/src/index.ts` — Add `/v1/hackernews` route handler with caching headers; extend `/health` JSON to include HN status.

**Extension — modified files:**
- `extension/src/sources/hacker-news/fetch.ts` — Replace 31-request fan-out with single GET to `/v1/hackernews`.
- `extension/src/sources/hacker-news/index.ts` — Drop `ttlMs` from 5 minutes to 60 seconds.
- `extension/src/lib/useSourceData.ts` — Don't `setItems` or `writeCache` when the fresh response is an empty array (defense in depth — keep last-good).
- `extension/src/components/ColumnCard.tsx` — Fix the conditional rendering: error branch must trigger on empty-array results too, and add an explicit empty-state element so `items.length === 0` doesn't produce a silent blank pane.
- `extension/public/manifest.json` — Drop `https://hacker-news.firebaseio.com/*` from `host_permissions` and `connect-src`.

**Docs — modified files:**
- `CHANGELOG.md` — Add `Changed` / `Fixed` / `Removed` entries under `[Unreleased]`.

---

## Phase A — Server changes

### Task 1: Add HN types

**Files:**
- Modify: `server/src/types.ts`

- [ ] **Step 1: Append HN types to the existing file**

Open `server/src/types.ts`. After the existing `ScrapeFn` type (currently the last line), append:

```ts

export type HnStory = {
	id: number;
	title: string;
	url: string;
	hnUrl: string;
	domain: string | null;
	author: string;
	score: number;
	comments: number;
	createdAtMs: number;
};

export type HnCacheEntry = {
	data: HnStory[];
	updatedAt: number;
};
```

(Note: tabs, double quotes, semicolons — `oxfmt` will normalize anyway.)

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @hackdrop/server typecheck`
Expected: exits 0 with no output.

---

### Task 2: Create the HN fetcher

**Files:**
- Create: `server/src/hackernews.ts`

- [ ] **Step 1: Write the fetcher**

Create `server/src/hackernews.ts` with this complete content:

```ts
import { pino } from "pino";
import type { HnStory } from "./types.ts";

const logger = pino({ name: "hackernews" });

const API = "https://hacker-news.firebaseio.com/v0";
const STORY_COUNT = 30;
const REQUEST_TIMEOUT_MS = 8_000;
const MIN_VALID_ITEM_COUNT = 5;
const USER_AGENT = "Hackdrop/0.1 (+https://github.com/theedoran/hackdrop)";

export class HnFetchError extends Error {
	constructor(
		message: string,
		public readonly itemCount?: number
	) {
		super(message);
		this.name = "HnFetchError";
	}
}

type RawItem = {
	id: number;
	type?: string;
	by?: string;
	title?: string;
	url?: string;
	score?: number;
	descendants?: number;
	time?: number;
	deleted?: boolean;
	dead?: boolean;
};

export async function fetchHackerNews(): Promise<HnStory[]> {
	const ids = await fetchTopStoryIds();
	const wanted = ids.slice(0, STORY_COUNT);

	const settled = await Promise.allSettled(wanted.map(fetchItem));
	const items = settled
		.map((s) => (s.status === "fulfilled" ? s.value : null))
		.filter(
			(it): it is RawItem => it != null && !it.deleted && !it.dead && it.type === "story" && !!it.title
		);

	if (items.length < MIN_VALID_ITEM_COUNT) {
		throw new HnFetchError(`HN fan-out yielded only ${items.length} valid items`, items.length);
	}

	const stories = items.map(toStory);
	logger.info({ count: stories.length }, "hn fetch ok");
	return stories;
}

async function fetchTopStoryIds(): Promise<number[]> {
	const res = await fetchWithTimeout(`${API}/topstories.json`);
	if (!res.ok) throw new HnFetchError(`topstories.json returned ${res.status}`);
	const json: unknown = await res.json();
	if (!Array.isArray(json)) throw new HnFetchError("topstories.json: expected array");
	return json.filter((n): n is number => Number.isInteger(n) && (n as number) > 0);
}

async function fetchItem(id: number): Promise<RawItem | null> {
	const res = await fetchWithTimeout(`${API}/item/${id}.json`);
	if (!res.ok) return null;
	const raw: unknown = await res.json();
	return isRawItem(raw) ? raw : null;
}

async function fetchWithTimeout(url: string): Promise<Response> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
	try {
		return await fetch(url, {
			signal: ctrl.signal,
			redirect: "error",
			headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
		});
	} finally {
		clearTimeout(timer);
	}
}

function isRawItem(value: unknown): value is RawItem {
	if (value === null || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return Number.isInteger(v.id) && (v.id as number) > 0;
}

function toStory(it: RawItem): HnStory {
	const id = it.id;
	const hnUrl = `https://news.ycombinator.com/item?id=${id}`;
	return {
		id,
		title: it.title ?? "",
		url: it.url ?? hnUrl,
		hnUrl,
		domain: extractDomain(it.url),
		author: it.by ?? "unknown",
		score: it.score ?? 0,
		comments: it.descendants ?? 0,
		createdAtMs: (it.time ?? 0) * 1000,
	};
}

function extractDomain(url: string | undefined): string | null {
	if (!url) return null;
	try {
		const host = new URL(url).hostname.replace(/^www\./, "");
		return host || null;
	} catch {
		return null;
	}
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @hackdrop/server typecheck`
Expected: exits 0.

- [ ] **Step 3: Manual probe — invoke the fetcher in isolation**

This validates the fetcher hits real Firebase and produces well-shaped data without wiring it through the cache or HTTP layer first.

Create a temporary one-shot probe at `server/scripts/_probe-hn.ts` (we'll delete it before committing):

```ts
import { fetchHackerNews } from "../src/hackernews.ts";

const stories = await fetchHackerNews();
console.log(`got ${stories.length} stories`);
console.log(JSON.stringify(stories[0], null, 2));
```

Run from the repo root: `pnpm --filter @hackdrop/server exec tsx scripts/_probe-hn.ts`

Expected: prints `got 30 stories` (or somewhere between `MIN_VALID_ITEM_COUNT` and 30) and a JSON object with `id`, `title`, `url`, `hnUrl`, `domain`, `author`, `score`, `comments`, `createdAtMs`.

- [ ] **Step 4: Delete the probe**

Run: `rm /Users/theedoran/Coding/hackdrop/server/scripts/_probe-hn.ts && rmdir /Users/theedoran/Coding/hackdrop/server/scripts`

(The directory only existed for the probe.)

---

### Task 3: Create the HN cache module

**Files:**
- Create: `server/src/hnCache.ts`

- [ ] **Step 1: Write the cache module**

Create `server/src/hnCache.ts`:

```ts
import { pino } from "pino";
import { fetchHackerNews, HnFetchError } from "./hackernews.ts";
import type { HnCacheEntry } from "./types.ts";

const logger = pino({ name: "hn-cache" });

const TTL_MS = 60 * 1000;

let entry: HnCacheEntry | null = null;
let inFlight: Promise<void> | null = null;
let lastFetchAt: number | null = null;
let lastFetchStatus: "ok" | "failed" | "pending" = "pending";

export type HnCacheState = {
	lastFetchAt: number | null;
	lastFetchStatus: typeof lastFetchStatus;
	cached: boolean;
};

export function snapshotHn(): HnCacheState {
	return { lastFetchAt, lastFetchStatus, cached: entry !== null };
}

export async function getHackerNews(): Promise<HnCacheEntry | null> {
	const now = Date.now();
	const isFresh = entry !== null && now - entry.updatedAt < TTL_MS;
	if (isFresh) return entry;

	// Stale or missing — kick off (or join) a refresh.
	if (!inFlight) {
		inFlight = refresh().finally(() => {
			inFlight = null;
		});
	}

	// If we have a stale entry, return it immediately while the refresh runs in
	// the background. The HTTP layer's stale-while-revalidate header makes this
	// safe for clients.
	if (entry) return entry;

	// Cold start: no cached entry yet — wait for the refresh to land or fail.
	await inFlight;
	return entry;
}

async function refresh(): Promise<void> {
	try {
		const data = await fetchHackerNews();
		entry = { data, updatedAt: Date.now() };
		lastFetchStatus = "ok";
	} catch (err) {
		lastFetchStatus = "failed";
		if (err instanceof HnFetchError) {
			logger.error({ err }, "hn fetch failed: keeping previous cache");
		} else {
			logger.error({ err }, "hn unexpected error: keeping previous cache");
		}
	} finally {
		lastFetchAt = Date.now();
	}
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @hackdrop/server typecheck`
Expected: exits 0.

---

### Task 4: Wire the route and update /health

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: Import the cache module**

In `server/src/index.ts`, find the existing import block at the top (lines 1-9). After the `import { getCached, snapshot } from "./cache.ts";` line, add:

```ts
import { getHackerNews, snapshotHn } from "./hnCache.ts";
```

- [ ] **Step 2: Extend the `/health` handler to include HN status**

Replace the existing `/health` handler (currently `server/src/index.ts:61-71`):

```ts
app.get("/health", (c) => {
	const snap = snapshot();
	c.header("Cache-Control", "no-store");
	return c.json({
		ok: true,
		lastScrapeAt: snap.lastScrapeAt ? new Date(snap.lastScrapeAt).toISOString() : null,
		lastScrapeStatus: snap.lastScrapeStatus,
		cacheKeys: snap.cacheKeys,
		parserVersion: PARSER_VERSION,
	});
});
```

with:

```ts
app.get("/health", (c) => {
	const snap = snapshot();
	const hn = snapshotHn();
	c.header("Cache-Control", "no-store");
	return c.json({
		ok: true,
		lastScrapeAt: snap.lastScrapeAt ? new Date(snap.lastScrapeAt).toISOString() : null,
		lastScrapeStatus: snap.lastScrapeStatus,
		cacheKeys: snap.cacheKeys,
		parserVersion: PARSER_VERSION,
		hackerNews: {
			lastFetchAt: hn.lastFetchAt ? new Date(hn.lastFetchAt).toISOString() : null,
			lastFetchStatus: hn.lastFetchStatus,
			cached: hn.cached,
		},
	});
});
```

- [ ] **Step 3: Add the `/v1/hackernews` route**

In `server/src/index.ts`, find the line `app.route("/v1", v1);` (currently line 104). **Immediately before** it, after the closing `});` of the `/v1/github` handler, add:

```ts
	v1.get("/hackernews", async (c) => {
		const hn = await getHackerNews();
		if (!hn) {
			c.header("Cache-Control", "no-store");
			c.header("Retry-After", "10");
			return c.json({ error: "cache_warming", message: "Server is warming up; try again in a moment." }, 503);
		}

		c.header("Cache-Control", "public, s-maxage=60, max-age=30, stale-while-revalidate=120");
		c.header("Vary", "Accept-Encoding");
		c.header("X-Hackdrop-Updated-At", new Date(hn.updatedAt).toISOString());

		return c.json(hn.data);
	});
```

(Indentation: one tab — same as the surrounding `v1.get("/github", ...)` block.)

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @hackdrop/server typecheck`
Expected: exits 0.

---

### Task 5: End-to-end server smoke test

**Files:** none — verification only.

- [ ] **Step 1: Start the dev server**

Run: `pnpm --filter @hackdrop/server dev`
Expected: pino logs `hackdrop-api listening` with `port: 3000`. Leave it running.

- [ ] **Step 2: Probe `/v1/hackernews` (cold cache)**

In a second terminal: `curl -i http://127.0.0.1:3000/v1/hackernews`

Expected on cold cache:
- Status `503` with body `{"error":"cache_warming",...}` AND a `Retry-After: 10` header — OR (more likely after 1–2s) status `200` with a JSON array.

If `503`, wait ~5 seconds (the Firebase fan-out completes) then re-run. Should now return `200`.

- [ ] **Step 3: Verify caching headers and shape on a 200**

Run again: `curl -i http://127.0.0.1:3000/v1/hackernews | head -20`

Expected headers include:
- `Cache-Control: public, s-maxage=60, max-age=30, stale-while-revalidate=120`
- `X-Hackdrop-Updated-At: <ISO timestamp>`
- `Vary: Accept-Encoding`

Then `curl -s http://127.0.0.1:3000/v1/hackernews | head -c 400` — should show a JSON array starting with `[{"id":...,"title":"...","url":"...","hnUrl":"...","domain":...,"author":"...","score":...,"comments":...,"createdAtMs":...}`.

- [ ] **Step 4: Verify single-flight dedup**

Run: `for i in 1 2 3 4 5; do curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" http://127.0.0.1:3000/v1/hackernews & done; wait`

Expected: all five return `200` quickly. The server log (the `pino` output) should show **exactly one** `hn fetch ok` line for the burst (or zero if cache was already fresh) — confirming single-flight dedup.

- [ ] **Step 5: Verify `/health` reports HN status**

Run: `curl -s http://127.0.0.1:3000/health | python3 -m json.tool` (or pipe through `jq` if installed)

Expected: JSON includes a `hackerNews` object with `lastFetchAt` (ISO string), `lastFetchStatus: "ok"`, `cached: true`.

- [ ] **Step 6: Stop the dev server**

Press `Ctrl+C` in the dev-server terminal. Server should log `shutting down` and exit cleanly.

- [ ] **Step 7: Lint and format**

Run: `pnpm lint && pnpm fmt`
Expected: both exit 0. If `fmt` rewrote anything, that's fine — it'll be picked up by the next commit.

- [ ] **Step 8: Commit server changes**

```bash
git add server/src/types.ts server/src/hackernews.ts server/src/hnCache.ts server/src/index.ts
git status
```

Verify only those four files appear. Then:

```bash
git commit -m "$(cat <<'EOF'
feat(server): add /v1/hackernews endpoint

proxy hacker news firebase api with 60s in-memory cache, single-flight
dedup, and last-good-on-failure semantics. response is edge-cacheable
(s-maxage=60, swr=120) so most reads never reach origin.

shifts the 31-request fan-out off every browser and onto the server,
making it survivable when firebase wobbles.
EOF
)"
```

---

## Phase B — Extension changes

### Task 6: Switch the client fetcher to the server endpoint

**Files:**
- Modify: `extension/src/sources/hacker-news/fetch.ts`

- [ ] **Step 1: Replace the file contents**

Open `extension/src/sources/hacker-news/fetch.ts` and **replace the entire file** with:

```ts
import type { HnStory } from "./types";

const API_URL = "https://hackdrop-api.theedoran.xyz/v1/hackernews";

export async function fetchHackerNews(signal: AbortSignal): Promise<HnStory[]> {
	const res = await fetch(API_URL, { signal });
	if (!res.ok) throw new Error(`Hackdrop API ${res.status}`);
	const json: unknown = await res.json();
	if (!Array.isArray(json)) throw new Error("Hackdrop API: expected array");
	return json as HnStory[];
}
```

The shape returned by the server matches `HnStory` exactly (we built it that way in Task 2's `toStory`), so no client-side transform is needed.

- [ ] **Step 2: Typecheck the extension**

Run: `pnpm --filter @hackdrop/extension typecheck`
Expected: exits 0.

---

### Task 7: Shorten the extension cache TTL

**Files:**
- Modify: `extension/src/sources/hacker-news/index.ts`

- [ ] **Step 1: Change the TTL**

In `extension/src/sources/hacker-news/index.ts`, line 12 currently reads:

```ts
	cache: { key: "hacker-news", ttlMs: 5 * 60 * 1000 },
```

Replace with:

```ts
	cache: { key: "hacker-news", ttlMs: 60 * 1000 },
```

This matches the server-side TTL. Stale entries are still rendered immediately by `useSourceData` — the TTL only governs whether we trigger a background refetch.

---

### Task 8: Don't poison the local cache with empty results

**Files:**
- Modify: `extension/src/lib/useSourceData.ts`

- [ ] **Step 1: Guard the success path**

In `extension/src/lib/useSourceData.ts`, the current try-block (lines 30-35) reads:

```ts
				try {
					const fresh = await source.fetch(ctrl.signal);
					if (ctrl.signal.aborted) return;
					setItems(fresh);
					setError(null);
					await writeCache(source.cache.key, fresh);
				} catch (err) {
```

Replace those six lines with:

```ts
				try {
					const fresh = await source.fetch(ctrl.signal);
					if (ctrl.signal.aborted) return;
					if (fresh.length > 0) {
						setItems(fresh);
						setError(null);
						await writeCache(source.cache.key, fresh);
					}
				} catch (err) {
```

**Why:** if the server somehow returns `[]` (or a future source does), don't overwrite a good stale entry in storage and don't drop visible items from the UI. The empty-state UI added in Task 9 handles the cold-start case where `items` stays `null`.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @hackdrop/extension typecheck`
Expected: exits 0.

---

### Task 9: Fix the ColumnCard rendering — error condition + empty state

**Files:**
- Modify: `extension/src/components/ColumnCard.tsx`

- [ ] **Step 1: Replace the render block**

In `extension/src/components/ColumnCard.tsx`, the current scrollable region (lines 36-50) reads:

```tsx
				<div class="scroll-area min-h-0 flex-1 overflow-y-auto">
					{error && !items && <ErrorState message={error} />}

					{!error && isInitialLoad && <ItemSkeletonList />}

					{items && items.length > 0 && (
						<ul class="stagger divide-rule dark:divide-rule-dk divide-y">
							{items.map((item, i) => (
								<li key={i} style={`animation-delay:${Math.min(i, 12) * 30}ms`}>
									<Item item={item} />
								</li>
							))}
						</ul>
					)}
				</div>
```

Replace with:

```tsx
				<div class="scroll-area min-h-0 flex-1 overflow-y-auto">
					{error && (!items || items.length === 0) && <ErrorState message={error} />}

					{!error && isInitialLoad && <ItemSkeletonList />}

					{!error && !isInitialLoad && (items === null || items.length === 0) && (
						<div class="text-ink-3 dark:text-ink-3-dk px-4 py-6 text-sm">
							Nothing to show right now. Try again in a moment.
						</div>
					)}

					{items && items.length > 0 && (
						<ul class="stagger divide-rule dark:divide-rule-dk divide-y">
							{items.map((item, i) => (
								<li key={i} style={`animation-delay:${Math.min(i, 12) * 30}ms`}>
									<Item item={item} />
								</li>
							))}
						</ul>
					)}
				</div>
```

**What changed and why:**
- `error && !items` → `error && (!items || items.length === 0)`: arrays are truthy, so the old condition silently suppressed errors whenever a stale empty array was sitting in `items`. The new condition surfaces the error in both cases.
- Added empty-state branch: previously, if `items` was `null` or `[]` with no error and no longer loading, the pane rendered absolutely nothing. Now it shows a muted "Nothing to show right now" message — that's exactly the state the user originally reported as a blank screen.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @hackdrop/extension typecheck`
Expected: exits 0.

---

### Task 10: Drop the Firebase host permission

**Files:**
- Modify: `extension/public/manifest.json`

- [ ] **Step 1: Remove `hacker-news.firebaseio.com` from `host_permissions`**

In `extension/public/manifest.json`, line 17 currently reads:

```json
	"host_permissions": ["https://hacker-news.firebaseio.com/*", "https://hackdrop-api.theedoran.xyz/*"],
```

Replace with:

```json
	"host_permissions": ["https://hackdrop-api.theedoran.xyz/*"],
```

- [ ] **Step 2: Remove `hacker-news.firebaseio.com` from `connect-src`**

In the same file, line 19 currently reads:

```json
		"extension_pages": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src https://hackdrop-api.theedoran.xyz https://hacker-news.firebaseio.com; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'"
```

Replace with:

```json
		"extension_pages": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src https://hackdrop-api.theedoran.xyz; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'"
```

- [ ] **Step 3: Verify the manifest is still valid JSON**

Run: `python3 -m json.tool < extension/public/manifest.json > /dev/null`
Expected: exits 0 with no output.

---

### Task 11: Build, load, and smoke-test the extension

**Files:** none — verification only.

- [ ] **Step 1: Build the extension**

Run: `pnpm --filter @hackdrop/extension build`
Expected: exits 0. `extension/dist/` updated. The build runs `tsc --noEmit && vite build` per CLAUDE.md.

- [ ] **Step 2: Decide where to point the extension during this smoke test**

The extension's `fetch.ts` hardcodes `https://hackdrop-api.theedoran.xyz/v1/hackernews`. If the server changes from Phase A haven't been deployed yet, the prod endpoint won't have `/v1/hackernews` and the extension will see a 404.

**If the server isn't deployed yet:** temporarily edit `extension/src/sources/hacker-news/fetch.ts` to point at your local server — change `API_URL` to `http://127.0.0.1:3000/v1/hackernews`, **and** add `http://127.0.0.1:3000/*` to `host_permissions` and `connect-src http://127.0.0.1:3000` in `manifest.json`. Rebuild. Run the server with `pnpm --filter @hackdrop/server dev` in a second terminal. **Revert both files before committing.**

**If the server is already deployed:** skip this step.

- [ ] **Step 3: Load the unpacked extension**

In Chrome / a Chromium browser:
1. Open `chrome://extensions`.
2. Enable "Developer mode".
3. Click "Load unpacked", select `extension/dist/`.
4. If you previously loaded an earlier build, click its refresh icon instead.

- [ ] **Step 4: Verify the Hacker News column loads**

Open a new tab. Confirm:
- The Hacker News column shows ~30 stories.
- Network tab in DevTools shows exactly **one** request to `https://hackdrop-api.theedoran.xyz/v1/hackernews` (or `http://127.0.0.1:3000/v1/hackernews` if you redirected to local) returning `200` — and **zero** requests to `hacker-news.firebaseio.com`.
- Story rows render correctly: title, score, author, comments, domain.

- [ ] **Step 5: Verify the empty-state path (best-effort)**

Open DevTools → Application → Storage → Local Storage. Find the entry `hackdrop:hacker-news` and edit its value to `{"data":[],"storedAt":<some-recent-timestamp-in-ms>}`. Reload the new tab.

Expected: the column briefly shows "Nothing to show right now. Try again in a moment." (the new empty-state) and then populates with real data once the background refetch completes. If it stays empty, that's also acceptable behavior — the empty-state should at minimum render instead of a silent blank.

Then clear that storage key (or just open another new tab — it will be overwritten on a successful fetch).

- [ ] **Step 6: Verify the error-state path (optional but recommended)**

Quickly toggle airplane mode (or block `hackdrop-api.theedoran.xyz` in DevTools' Network tab → "Block request domain"). Clear the `hackdrop:hacker-news` storage entry. Reload a new tab. Expected: the column shows the `ErrorState` UI ("Couldn't load. Hackdrop API …" or similar). Re-enable the network and reload — column populates again.

- [ ] **Step 7: If you redirected to localhost in step 2, revert**

Restore the original `API_URL = "https://hackdrop-api.theedoran.xyz/v1/hackernews"` in `extension/src/sources/hacker-news/fetch.ts` and the original `manifest.json`. Rebuild: `pnpm --filter @hackdrop/extension build`.

Verify with `git diff extension/src/sources/hacker-news/fetch.ts extension/public/manifest.json` that only the intended changes (server URL stays as prod, Firebase entries removed) remain.

- [ ] **Step 8: Lint and format**

Run: `pnpm lint && pnpm fmt`
Expected: both exit 0.

- [ ] **Step 9: Commit extension changes**

```bash
git add extension/src/sources/hacker-news/fetch.ts \
        extension/src/sources/hacker-news/index.ts \
        extension/src/lib/useSourceData.ts \
        extension/src/components/ColumnCard.tsx \
        extension/public/manifest.json
git status
```

Verify exactly those five files. Then:

```bash
git commit -m "$(cat <<'EOF'
feat(extension): fetch hacker news through hackdrop api

drops the 31-request firebase fan-out from every browser in favor of a
single request to /v1/hackernews. removes the
hacker-news.firebaseio.com host permission and tightens the local
cache ttl to 60s to match the server.

also fixes a blank-screen bug: columncard now surfaces errors when
items is an empty array (previously suppressed because [] is truthy)
and renders an explicit empty state instead of nothing. usesourcedata
no longer overwrites a good cache entry with an empty fresh result.
EOF
)"
```

---

## Phase C — Docs

### Task 12: Update CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add entries under `[Unreleased]`**

Open `CHANGELOG.md`. Find the `## [Unreleased]` section near the top. The existing structure has `### Added`, `### Changed`, `### Fixed` subsections.

Under `### Changed`, append a new bullet at the bottom of the existing list:

```markdown
- Hacker News data now flows through the Hackdrop server instead of being fetched directly from the Hacker News API by every browser. Pages load faster, results are edge-cached, and the column survives transient API hiccups by holding the previously-loaded stories.
```

Under `### Fixed`, append a new bullet:

```markdown
- The Hacker News column could go silently blank — no error, no items — when the upstream API was briefly flaky. It now shows the last known stories or a clear "Couldn't load" message instead.
```

If a `### Removed` subsection doesn't exist between `### Fixed` and `## [0.1.0]`, add one:

```markdown
### Removed

- The extension no longer needs the `hacker-news.firebaseio.com` host permission, since Hacker News data is fetched through the Hackdrop server.
```

If `### Removed` already exists under `[Unreleased]`, append the bullet to it instead of creating a new subsection.

- [ ] **Step 2: Verify the changelog still parses sensibly**

Run: `head -40 CHANGELOG.md`
Expected: the new bullets appear under their correct subsections; subsection ordering remains `Added` → `Changed` → `Fixed` → `Removed`.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "$(cat <<'EOF'
docs(changelog): note hacker news server-side migration
EOF
)"
```

---

## Final verification

- [ ] **Step 1: Workspace-wide checks**

```bash
pnpm lint
pnpm fmt
pnpm build
```

Expected: all three exit 0. The `pnpm build` runs both `extension` and `server` builds in parallel.

- [ ] **Step 2: Confirm no leftover artifacts**

```bash
git status
```

Expected: clean tree (everything committed). No untracked `_probe-hn.ts` or stray scripts directory under `server/`.

- [ ] **Step 3: Review the diff before pushing**

```bash
git log --oneline -3
git diff main..HEAD --stat
```

Expected: three commits (server, extension, changelog) and the stat shows changes only in the files listed in the File Structure section above.

---

## Deployment notes

This plan does not push to `main`, deploy the server, or release a new extension version. Operator follow-ups:

1. **Deploy the server first.** Push commits, run the existing deploy flow (Docker build with repo-root context per `server/DEPLOYMENT.md`). Verify in production:
   - `curl -i https://hackdrop-api.theedoran.xyz/v1/hackernews` returns `200` with the expected JSON shape and the `Cache-Control: public, s-maxage=60, ...` header.
   - `curl https://hackdrop-api.theedoran.xyz/health` shows `hackerNews.lastFetchStatus: "ok"`.
   - On a second request within 60s, look for `CF-Cache-Status: HIT` (Cloudflare edge cache working).

2. **Then release the extension.** The extension shipped to users will hit the prod endpoint as soon as it's deployed; releasing the extension before the server is deployed will break Hacker News for end users. Use `pnpm release <patch|minor|major|x.y.z>` per CLAUDE.md — this is a `minor` bump (new behavior, no breaking changes to users' cached data shape; the `hackdrop:hacker-news` storage entry's data shape is unchanged).
