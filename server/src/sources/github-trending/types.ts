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
