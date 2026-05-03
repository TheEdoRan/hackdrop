import { serve } from "@hono/node-server";
import { pino } from "pino";
import { startScheduler } from "./cache.ts";
import { createApp } from "./index.ts";
import { scrapeTrending } from "./scrape.ts";

const logger = pino({
	name: "server",
	...(process.env.NODE_ENV !== "production"
		? { transport: { target: "pino-pretty", options: { colorize: true } } }
		: {}),
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const app = createApp();
const { stop: stopScheduler } = startScheduler(scrapeTrending);

const server = serve({ fetch: app.fetch, port, hostname: host }, (info) => {
	logger.info({ port: info.port, host }, "hackdrop-api listening");
});

const shutdown = (signal: string) => {
	logger.info({ signal }, "shutting down");
	stopScheduler();
	server.close(() => process.exit(0));
	setTimeout(() => process.exit(1), 5_000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
