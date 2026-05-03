import { pino } from "pino";
import { ParserDriftError } from "./scrape.ts";
import type { CacheEntry, ScrapeFn, ScrapeTarget } from "./types.ts";

const logger = pino({ name: "cache" });

const REFRESH_MS = 30 * 60 * 1000;
const TARGETS: ScrapeTarget[] = [{ since: "daily" }, { since: "weekly" }, { since: "monthly" }];

const store = new Map<string, CacheEntry>();
let lastScrapeAt: number | null = null;
let lastScrapeStatus: "ok" | "failed" | "pending" = "pending";

export function keyOf(target: ScrapeTarget): string {
	return target.since;
}

export function getCached(target: ScrapeTarget): CacheEntry | undefined {
	return store.get(keyOf(target));
}

export function snapshot(): {
	lastScrapeAt: number | null;
	lastScrapeStatus: typeof lastScrapeStatus;
	cacheKeys: string[];
} {
	return {
		lastScrapeAt,
		lastScrapeStatus,
		cacheKeys: [...store.keys()],
	};
}

export function startScheduler(scrape: ScrapeFn): { stop: () => void } {
	const tick = async () => {
		for (const target of TARGETS) {
			try {
				const data = await scrape(target);
				store.set(keyOf(target), { data, updatedAt: Date.now() });
				lastScrapeStatus = "ok";
			} catch (err) {
				lastScrapeStatus = "failed";
				if (err instanceof ParserDriftError) {
					logger.error({ err, target }, "parser_drift: keeping previous cache");
				} else {
					logger.error({ err, target }, "scrape failed: keeping previous cache");
				}
			}
		}
		lastScrapeAt = Date.now();
	};

	void tick();
	const handle = setInterval(tick, REFRESH_MS);
	return { stop: () => clearInterval(handle) };
}
