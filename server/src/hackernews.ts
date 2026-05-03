import { pino } from "pino";
import type { HnStory } from "./types.ts";

const logger = pino({ name: "hackernews" });

const API = "https://hacker-news.firebaseio.com/v0";
const STORY_COUNT = 30;
const REQUEST_TIMEOUT_MS = 8_000;
const MIN_VALID_ITEM_COUNT = 5;
const USER_AGENT = "Hackdrop/0.1 (+https://github.com/theedoran/hackdrop)";

export class HnFetchError extends Error {
	constructor(
		message: string,
		public readonly itemCount?: number
	) {
		super(message);
		this.name = "HnFetchError";
	}
}

type RawItem = {
	id: number;
	type?: string;
	by?: string;
	title?: string;
	url?: string;
	score?: number;
	descendants?: number;
	time?: number;
	deleted?: boolean;
	dead?: boolean;
};

export async function fetchHackerNews(): Promise<HnStory[]> {
	const ids = await fetchTopStoryIds();
	const wanted = ids.slice(0, STORY_COUNT);

	const settled = await Promise.allSettled(wanted.map(fetchItem));
	const items = settled
		.map((s) => (s.status === "fulfilled" ? s.value : null))
		.filter((it): it is RawItem => it != null && !it.deleted && !it.dead && it.type === "story" && !!it.title);

	if (items.length < MIN_VALID_ITEM_COUNT) {
		throw new HnFetchError(`HN fan-out yielded only ${items.length} valid items`, items.length);
	}

	const stories = items.map(toStory);
	logger.info({ count: stories.length }, "hn fetch ok");
	return stories;
}

async function fetchTopStoryIds(): Promise<number[]> {
	const res = await fetchWithTimeout(`${API}/topstories.json`);
	if (!res.ok) throw new HnFetchError(`topstories.json returned ${res.status}`);
	const json: unknown = await res.json();
	if (!Array.isArray(json)) throw new HnFetchError("topstories.json: expected array");
	return json.filter((n): n is number => Number.isInteger(n) && (n as number) > 0);
}

async function fetchItem(id: number): Promise<RawItem | null> {
	const res = await fetchWithTimeout(`${API}/item/${id}.json`);
	if (!res.ok) return null;
	const raw: unknown = await res.json();
	return isRawItem(raw) ? raw : null;
}

async function fetchWithTimeout(url: string): Promise<Response> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
	try {
		return await fetch(url, {
			signal: ctrl.signal,
			redirect: "error",
			headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
		});
	} finally {
		clearTimeout(timer);
	}
}

function isRawItem(value: unknown): value is RawItem {
	if (value === null || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return Number.isInteger(v.id) && (v.id as number) > 0;
}

function toStory(it: RawItem): HnStory {
	const id = it.id;
	const hnUrl = `https://news.ycombinator.com/item?id=${id}`;
	return {
		id,
		title: it.title ?? "",
		url: it.url ?? hnUrl,
		hnUrl,
		domain: extractDomain(it.url),
		author: it.by ?? "unknown",
		score: it.score ?? 0,
		comments: it.descendants ?? 0,
		createdAtMs: (it.time ?? 0) * 1000,
	};
}

function extractDomain(url: string | undefined): string | null {
	if (!url) return null;
	try {
		const host = new URL(url).hostname.replace(/^www\./, "");
		return host || null;
	} catch {
		return null;
	}
}
