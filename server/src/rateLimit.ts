import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context, MiddlewareHandler } from "hono";

type Bucket = { count: number; resetAt: number };

export type RateLimitOptions = {
	windowMs: number;
	max: number;
	// Sweep interval for evicting expired buckets so the Map can't grow without
	// bound. Defaults to one window length.
	sweepIntervalMs?: number;
};

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
	const { windowMs, max } = options;
	const sweepIntervalMs = options.sweepIntervalMs ?? windowMs;
	const buckets = new Map<string, Bucket>();

	const sweep = setInterval(() => {
		const now = Date.now();
		for (const [k, b] of buckets) {
			if (b.resetAt <= now) buckets.delete(k);
		}
	}, sweepIntervalMs);
	sweep.unref();

	return async (c, next) => {
		const key = clientKey(c);
		const now = Date.now();
		let bucket = buckets.get(key);
		if (!bucket || bucket.resetAt <= now) {
			bucket = { count: 0, resetAt: now + windowMs };
			buckets.set(key, bucket);
		}
		bucket.count++;
		const remaining = Math.max(0, max - bucket.count);
		const resetSec = Math.ceil(bucket.resetAt / 1000);

		c.header("X-RateLimit-Limit", String(max));
		c.header("X-RateLimit-Remaining", String(remaining));
		c.header("X-RateLimit-Reset", String(resetSec));

		if (bucket.count > max) {
			const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
			c.header("Retry-After", String(retryAfterSec));
			c.header("Cache-Control", "no-store");
			return c.json({ error: "rate_limited", message: "Too many requests; slow down." }, 429);
		}

		await next();
	};
}

// The canonical Hackdrop deployment runs behind a reverse proxy on a private
// Docker network, so X-Forwarded-For carries the real client IP and cannot be
// spoofed by external callers (the proxy strips inbound XFF and rewrites it).
// If the server is ever exposed directly, fall back to the socket's remote
// address.
function clientKey(c: Context): string {
	const xff = c.req.header("x-forwarded-for");
	if (xff) {
		const first = xff.split(",")[0]?.trim();
		if (first) return first;
	}
	const real = c.req.header("x-real-ip")?.trim();
	if (real) return real;
	const info = getConnInfo(c);
	return info.remote.address ?? "unknown";
}
