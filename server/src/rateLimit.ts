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

// Production chain is Cloudflare → Nginx Proxy Manager → this container.
// Cloudflare appends to inbound X-Forwarded-For rather than stripping it, and
// NPM's `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` appends
// once more — so XFF[0] is whatever the original caller chose. The only
// client-IP value that's actually trustworthy is CF-Connecting-IP, set by
// Cloudflare and forwarded through unchanged. If the request bypasses the
// CF→NPM path (local debug, regression in proxy config), there's no client
// header we can trust, so fall back to the socket address.
function clientKey(c: Context): string {
	const cf = c.req.header("cf-connecting-ip")?.trim();
	if (cf) return cf;
	const info = getConnInfo(c);
	return info.remote.address ?? "unknown";
}
