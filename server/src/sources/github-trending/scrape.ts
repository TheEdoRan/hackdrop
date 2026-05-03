import { Buffer } from "node:buffer";
import * as cheerio from "cheerio";
import { pino } from "pino";
import type { ScrapeTarget, TrendingRepo } from "./types.ts";

const logger = pino({ name: "github-trending:scrape" });

const USER_AGENT = "Hackdrop/0.1 (+https://github.com/theedoran/hackdrop)";
const REQUEST_TIMEOUT_MS = 10_000;
const MIN_VALID_ITEM_COUNT = 5;
const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_DESCRIPTION_LEN = 500;
const MAX_LANGUAGE_LEN = 60;
const SLUG_RE = /^[A-Za-z0-9._-]{1,100}$/;
// Accept only hex (#abc / #abcd / #aabbcc / #aabbccdd) or rgb()/rgba() — no
// arbitrary strings, no `url(...)`, no semicolons.
const COLOR_RE = /^(?:#[0-9a-fA-F]{3,8}|rgba?\([0-9., %/\s]+\))$/;

export class ParserDriftError extends Error {
	constructor(public readonly itemCount: number) {
		super(`Parser drift detected: only ${itemCount} items extracted from trending page`);
		this.name = "ParserDriftError";
	}
}

export async function scrapeTrending(target: ScrapeTarget): Promise<TrendingRepo[]> {
	const url = buildUrl(target);
	const html = await fetchHtml(url);
	const repos = parseTrendingHtml(html);

	if (repos.length < MIN_VALID_ITEM_COUNT) {
		throw new ParserDriftError(repos.length);
	}

	logger.info({ url, count: repos.length }, "scrape ok");
	return repos;
}

function buildUrl({ since }: ScrapeTarget): string {
	const params = new URLSearchParams({ since });
	return `https://github.com/trending?${params.toString()}`;
}

async function fetchHtml(url: string): Promise<string> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const res = await fetch(url, {
			headers: {
				"User-Agent": USER_AGENT,
				"Accept": "text/html,application/xhtml+xml",
				"Accept-Language": "en-US,en;q=0.9",
			},
			signal: controller.signal,
			// Refuse to follow redirects: the upstream is pinned to github.com and
			// any 3xx is either a sign of breakage or an attempt to redirect us
			// somewhere we shouldn't fetch.
			redirect: "error",
		});
		if (!res.ok) {
			throw new Error(`GitHub returned ${res.status} ${res.statusText} for ${url}`);
		}
		return await readBodyCapped(res, MAX_HTML_BYTES);
	} finally {
		clearTimeout(timer);
	}
}

async function readBodyCapped(res: Response, maxBytes: number): Promise<string> {
	if (!res.body) throw new Error("upstream response has no body");
	const reader = res.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			if (!value) continue;
			total += value.byteLength;
			if (total > maxBytes) {
				throw new Error(`upstream body exceeded ${maxBytes} bytes`);
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	return Buffer.concat(chunks).toString("utf8");
}

export function parseTrendingHtml(html: string): TrendingRepo[] {
	const $ = cheerio.load(html);
	const repos: TrendingRepo[] = [];

	$("article.Box-row").each((_, el) => {
		const $el = $(el);

		const href = $el.find("h2 a").first().attr("href")?.trim();
		if (!href) return;

		const slug = href.replace(/^\//, "");
		const [owner, name] = slug.split("/");
		if (!owner || !name) return;
		if (!SLUG_RE.test(owner) || !SLUG_RE.test(name)) return;

		const description = capLength(textOrNull($el.find("p").first().text()), MAX_DESCRIPTION_LEN);
		const language = capLength(
			textOrNull($el.find('[itemprop="programmingLanguage"]').first().text()),
			MAX_LANGUAGE_LEN
		);

		const rawColor = $el
			.find(".repo-language-color")
			.first()
			.attr("style")
			?.match(/background-color:\s*([^;]+)/)?.[1]
			?.trim();
		const languageColor = rawColor && COLOR_RE.test(rawColor) ? rawColor : null;

		const stars = parseIntegerWithCommas($el.find(`a[href="/${slug}/stargazers"]`).first().text());
		const forks = parseIntegerWithCommas($el.find(`a[href="/${slug}/forks"]`).first().text());
		const starsToday = parseStarsToday($el.find("span.d-inline-block.float-sm-right").first().text());

		repos.push({
			owner,
			name,
			url: `https://github.com/${owner}/${name}`,
			description,
			language,
			languageColor,
			stars,
			forks,
			starsToday,
		});
	});

	return repos;
}

function textOrNull(raw: string): string | null {
	const text = raw.trim().replace(/\s+/g, " ");
	return text.length > 0 ? text : null;
}

function capLength(text: string | null, max: number): string | null {
	if (text === null) return null;
	return text.length > max ? text.slice(0, max) : text;
}

function parseIntegerWithCommas(text: string): number {
	const match = text.match(/[\d,]+/);
	if (!match) return 0;
	return Number.parseInt(match[0].replace(/,/g, ""), 10) || 0;
}

function parseStarsToday(text: string): number {
	const match = text.match(/([\d,]+)\s+stars?\s+(?:today|this\s+week|this\s+month)/i);
	const captured = match?.[1];
	if (!captured) return 0;
	return Number.parseInt(captured.replace(/,/g, ""), 10) || 0;
}
