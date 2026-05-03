import type { ComponentType } from "preact";

export type SourceId = "github-trending" | "hacker-news";

export type SourceMeta = {
	id: SourceId;
	name: string;
	externalUrl: string;
	brand: "github" | "hn";
	Icon: ComponentType<{ className?: string }>;
};

export type Source<TItem> = SourceMeta & {
	cache: { key: string; ttlMs: number };
	fetch(signal: AbortSignal): Promise<TItem[]>;
	Item: ComponentType<{ item: TItem }>;
};
