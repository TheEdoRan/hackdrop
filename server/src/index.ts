import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { timeout } from "hono/timeout";
import { pino } from "pino";
import { getCached, snapshot } from "./cache.ts";
import { getHackerNews, snapshotHn } from "./hnCache.ts";
import { rateLimit } from "./rateLimit.ts";
import type { Since } from "./types.ts";

const PARSER_VERSION = 1;
const HANDLER_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;

const VALID_SINCE: ReadonlySet<Since> = new Set(["daily", "weekly", "monthly"]);

// `/internal/status` is registered only when the token is set, so an
// unconfigured deployment 404s rather than exposing the endpoint at all.
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN ?? null;

const logger = pino({ name: "http" });

export function createApp(): Hono {
	const app = new Hono();

	app.use(
		"*",
		secureHeaders({
			contentSecurityPolicy: {
				defaultSrc: ["'none'"],
				frameAncestors: ["'none'"],
			},
			// CORP must be `cross-origin` so browser extensions can read responses;
			// the secureHeaders default of `same-origin` would block them.
			crossOriginResourcePolicy: "cross-origin",
			crossOriginOpenerPolicy: false,
			crossOriginEmbedderPolicy: false,
			xFrameOptions: "DENY",
			referrerPolicy: "no-referrer",
		})
	);
	app.use(
		"*",
		cors({
			origin: "*",
			allowMethods: ["GET", "OPTIONS"],
			allowHeaders: ["Content-Type"],
			exposeHeaders: ["X-Hackdrop-Updated-At", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
			credentials: false,
			maxAge: 86_400,
		})
	);
	app.use("*", bodyLimit({ maxSize: MAX_BODY_BYTES }));
	app.use("*", timeout(HANDLER_TIMEOUT_MS));
	app.use("*", rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX }));

	app.get("/health", (c) => {
		c.header("Cache-Control", "no-store");
		return c.json({ ok: true });
	});

	if (INTERNAL_TOKEN) {
		app.get("/internal/status", (c) => {
			if (c.req.header("x-internal-token") !== INTERNAL_TOKEN) {
				c.header("Cache-Control", "no-store");
				return c.json({ error: "forbidden" }, 403);
			}
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
	}

	const v1 = new Hono();

	v1.get("/github", (c) => {
		const sinceParam = c.req.query("since") ?? "daily";
		if (!VALID_SINCE.has(sinceParam as Since)) {
			c.header("Cache-Control", "no-store");
			return c.json({ error: "invalid_since", message: "since must be one of: daily, weekly, monthly." }, 400);
		}
		// Filtering by language is intentionally unsupported — reject any caller
		// that passes one rather than silently ignoring it.
		if (c.req.query("language")) {
			c.header("Cache-Control", "no-store");
			return c.json({ error: "language_not_supported", message: "Filtering by language is not supported." }, 400);
		}

		const since = sinceParam as Since;
		const entry = getCached({ since });
		if (!entry) {
			c.header("Cache-Control", "no-store");
			c.header("Retry-After", "10");
			return c.json({ error: "cache_warming", message: "Server is warming up; try again in a moment." }, 503);
		}

		c.header("Cache-Control", "public, s-maxage=3600, max-age=1800, stale-while-revalidate=1800");
		c.header("Vary", "Accept-Encoding");
		c.header("X-Hackdrop-Updated-At", new Date(entry.updatedAt).toISOString());

		return c.json(entry.data);
	});

	v1.get("/hackernews", async (c) => {
		const hn = await getHackerNews();
		if (!hn) {
			c.header("Cache-Control", "no-store");
			c.header("Retry-After", "10");
			return c.json({ error: "cache_warming", message: "Server is warming up; try again in a moment." }, 503);
		}

		c.header("Cache-Control", "public, s-maxage=300, max-age=120, stale-while-revalidate=600");
		c.header("Vary", "Accept-Encoding");
		c.header("X-Hackdrop-Updated-At", new Date(hn.updatedAt).toISOString());

		return c.json(hn.data);
	});

	app.route("/v1", v1);

	app.notFound((c) => c.json({ error: "not_found" }, 404));

	app.onError((err, c) => {
		logger.error({ err, path: c.req.path }, "unhandled");
		return c.json({ error: "internal_error" }, 500);
	});

	return app;
}
