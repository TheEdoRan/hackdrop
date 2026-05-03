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
// Default to loopback so a stray local `node dist/server.js` doesn't expose
// the port on every interface; the Dockerfile sets HOST=0.0.0.0 explicitly.
const host = process.env.HOST ?? "127.0.0.1";

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
process.on("unhandledRejection", (reason) => {
	logger.fatal({ reason }, "unhandled_rejection");
	process.exit(1);
});
process.on("uncaughtException", (err) => {
	logger.fatal({ err }, "uncaught_exception");
	process.exit(1);
});
