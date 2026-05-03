import { pino } from "pino";
import { fetchHackerNews, HnFetchError } from "./hackernews.ts";
import type { HnCacheEntry } from "./types.ts";

const logger = pino({ name: "hn-cache" });

const TTL_MS = 5 * 60 * 1000;

let entry: HnCacheEntry | null = null;
let inFlight: Promise<void> | null = null;
let lastFetchAt: number | null = null;
let lastFetchStatus: "ok" | "failed" | "pending" = "pending";

export type HnCacheState = {
	lastFetchAt: number | null;
	lastFetchStatus: "ok" | "failed" | "pending";
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
