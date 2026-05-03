import * as cheerio from "cheerio";
import { pino } from "pino";
import type { ScrapeTarget, TrendingRepo } from "./types.ts";

const logger = pino({ name: "scrape" });

const USER_AGENT = "Hackdrop/0.1 (+https://github.com/theedoran/hackdrop)";
const REQUEST_TIMEOUT_MS = 10_000;
const MIN_VALID_ITEM_COUNT = 5;

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

function buildUrl({ since, language }: ScrapeTarget): string {
	const params = new URLSearchParams({ since });
	if (language) params.set("language", language);
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
		});
		if (!res.ok) {
			throw new Error(`GitHub returned ${res.status} ${res.statusText} for ${url}`);
		}
		return await res.text();
	} finally {
		clearTimeout(timer);
	}
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

		const description = textOrNull($el.find("p").first().text());
		const language = textOrNull($el.find('[itemprop="programmingLanguage"]').first().text());

		const languageColor =
			$el
				.find(".repo-language-color")
				.first()
				.attr("style")
				?.match(/background-color:\s*([^;]+)/)?.[1]
				?.trim() ?? null;

		const stars = parseIntegerWithCommas($el.find(`a[href="/${slug}/stargazers"]`).first().text());
		const forks = parseIntegerWithCommas($el.find(`a[href="/${slug}/forks"]`).first().text());
		const starsToday = parseStarsToday($el.find("span.d-inline-block.float-sm-right").first().text());

		repos.push({
			owner,
			name,
			url: `https://github.com/${slug}`,
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
