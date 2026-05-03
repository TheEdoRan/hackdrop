import type { Period } from "./period";
import type { TrendingRepo } from "./types";

const API_URL = "https://hackdrop-api.theedoran.xyz";

export async function fetchTrending(period: Period, signal: AbortSignal): Promise<TrendingRepo[]> {
	const res = await fetch(`${API_URL}/v1/github?since=${period}`, { signal });
	if (!res.ok) {
		throw new Error(`Hackdrop API ${res.status} ${res.statusText}`);
	}
	return (await res.json()) as TrendingRepo[];
}
