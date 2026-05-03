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
