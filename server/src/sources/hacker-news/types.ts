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
