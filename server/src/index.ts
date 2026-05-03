import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCached, snapshot } from "./cache.ts";
import type { Since } from "./types.ts";

const PARSER_VERSION = 1;

const VALID_SINCE: ReadonlySet<Since> = new Set(["daily", "weekly", "monthly"]);

export function createApp(): Hono {
	const app = new Hono();

	app.use(
		"*",
		cors({
			origin: "*",
			allowMethods: ["GET", "OPTIONS"],
			allowHeaders: ["Content-Type"],
			maxAge: 86_400,
		})
	);

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

	const v1 = new Hono();

	v1.get("/github", (c) => {
		const sinceParam = (c.req.query("since") ?? "daily") as Since;
		const since = VALID_SINCE.has(sinceParam) ? sinceParam : "daily";
		const language = c.req.query("language") ?? "";

		const entry = getCached({ since, language });
		if (!entry) {
			return c.json({ error: "cache_warming", message: "Server is warming up; try again in a moment." }, 503);
		}

		c.header("Cache-Control", "public, s-maxage=1800, max-age=600, stale-while-revalidate=600");
		c.header("X-Hackdrop-Updated-At", new Date(entry.updatedAt).toISOString());
		c.header("X-Hackdrop-Parser-Version", String(PARSER_VERSION));

		return c.json(entry.data);
	});

	app.route("/v1", v1);

	app.notFound((c) => c.json({ error: "not_found" }, 404));

	return app;
}
