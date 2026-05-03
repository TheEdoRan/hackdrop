import type { Period } from "./period";
import type { TrendingRepo } from "./types";

const API_URL = "https://hackdrop-api.theedoran.xyz";

export async function fetchTrending(period: Period, signal: AbortSignal): Promise<TrendingRepo[]> {
	const res = await fetch(`${API_URL}/v1/github?since=${period}`, { signal });
	if (!res.ok) {
		throw new Error(`Hackdrop API ${res.status} ${res.statusText}`);
	}
	const json: unknown = await res.json();
	if (!Array.isArray(json)) {
		throw new Error("Hackdrop API: expected array");
	}
	return json.filter(isTrendingRepo);
}

function isTrendingRepo(value: unknown): value is TrendingRepo {
	if (value === null || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.owner === "string" &&
		typeof v.name === "string" &&
		typeof v.url === "string" &&
		(v.description === null || typeof v.description === "string") &&
		(v.language === null || typeof v.language === "string") &&
		(v.languageColor === null || typeof v.languageColor === "string") &&
		typeof v.stars === "number" &&
		typeof v.forks === "number" &&
		typeof v.starsToday === "number"
	);
}
