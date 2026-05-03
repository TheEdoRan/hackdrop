import type { HnStory } from "./types";

const API_URL = "https://hackdrop-api.theedoran.xyz/v1/hackernews";

export async function fetchHackerNews(signal: AbortSignal): Promise<HnStory[]> {
	const res = await fetch(API_URL, { signal });
	if (!res.ok) throw new Error(`Hackdrop API ${res.status}`);
	const json: unknown = await res.json();
	if (!Array.isArray(json)) throw new Error("Hackdrop API: expected array");
	return json as HnStory[];
}
