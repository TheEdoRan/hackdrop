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

	const ids = (await idsRes.json()) as number[];
	const wanted = ids.slice(0, STORY_COUNT);

	const items = await Promise.all(
		wanted.map(async (id): Promise<RawItem | null> => {
			const r = await fetch(`${API}/item/${id}.json`, { signal });
			if (!r.ok) return null;
			return (await r.json()) as RawItem;
		})
	);

	return items
		.filter((it): it is RawItem => it != null && !it.deleted && !it.dead && it.type === "story" && !!it.title)
		.map(
			(it): HnStory => ({
				id: it.id,
				title: it.title ?? "",
				url: it.url ?? `https://news.ycombinator.com/item?id=${it.id}`,
				hnUrl: `https://news.ycombinator.com/item?id=${it.id}`,
				domain: extractDomain(it.url),
				author: it.by ?? "unknown",
				score: it.score ?? 0,
				comments: it.descendants ?? 0,
				createdAtMs: (it.time ?? 0) * 1000,
			})
		);
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
