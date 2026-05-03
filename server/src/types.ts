export type TrendingRepo = {
	owner: string;
	name: string;
	url: string;
	description: string | null;
	language: string | null;
	languageColor: string | null;
	stars: number;
	forks: number;
	starsToday: number;
};

export type Since = "daily" | "weekly" | "monthly";

export type ScrapeTarget = {
	since: Since;
};

export type CacheEntry = {
	data: TrendingRepo[];
	updatedAt: number;
};

export type ScrapeFn = (target: ScrapeTarget) => Promise<TrendingRepo[]>;

export type HnStory = {
	id: number;
	title: string;
	url: string;
	hnUrl: string;
	domain: string | null;
	author: string;
	score: number;
	comments: number;
	createdAtMs: number;
};

export type HnCacheEntry = {
	data: HnStory[];
	updatedAt: number;
};
