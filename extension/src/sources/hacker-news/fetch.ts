import type { HnStory } from "./types";

const API = "https://hacker-news.firebaseio.com/v0";
const STORY_COUNT = 30;

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

export async function fetchHackerNews(signal: AbortSignal): Promise<HnStory[]> {
	const idsRes = await fetch(`${API}/topstories.json`, { signal });
	if (!idsRes.ok) throw new Error(`HN topstories ${idsRes.status}`);

	const idsJson: unknown = await idsRes.json();
	if (!Array.isArray(idsJson)) throw new Error("HN topstories: expected array");
	const wanted = idsJson.filter((n): n is number => Number.isInteger(n) && (n as number) > 0).slice(0, STORY_COUNT);

	const settled = await Promise.allSettled(
		wanted.map(async (id): Promise<RawItem | null> => {
			const r = await fetch(`${API}/item/${id}.json`, { signal });
			if (!r.ok) return null;
			const raw: unknown = await r.json();
			return isRawItem(raw) ? raw : null;
		})
	);

	const items = settled
		.map((s) => (s.status === "fulfilled" ? s.value : null))
		.filter((it): it is RawItem => it != null && !it.deleted && !it.dead && it.type === "story" && !!it.title);

	return items.map((it): HnStory => {
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
	});
}

function isRawItem(value: unknown): value is RawItem {
	if (value === null || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return Number.isInteger(v.id) && (v.id as number) > 0;
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
