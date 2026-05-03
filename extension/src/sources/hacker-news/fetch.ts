import type { HnStory } from "./types";

const API_URL = "https://hackdrop-api.theedoran.xyz/v1/hackernews";

export async function fetchHackerNews(signal: AbortSignal): Promise<HnStory[]> {
	const res = await fetch(API_URL, { signal });
	if (!res.ok) throw new Error(`Hackdrop API ${res.status}`);
	const json: unknown = await res.json();
	if (!Array.isArray(json)) throw new Error("Hackdrop API: expected array");
	return json.filter(isHnStory);
}

function isHnStory(value: unknown): value is HnStory {
	if (value === null || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.id === "number" &&
		typeof v.title === "string" &&
		typeof v.url === "string" &&
		typeof v.hnUrl === "string" &&
		(v.domain === null || typeof v.domain === "string") &&
		typeof v.author === "string" &&
		typeof v.score === "number" &&
		typeof v.comments === "number" &&
		typeof v.createdAtMs === "number"
	);
}
