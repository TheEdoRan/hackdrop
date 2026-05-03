import type { Source } from "../types";
import { fetchHackerNews } from "./fetch";
import { HackerNewsIcon } from "./Icon";
import { HackerNewsItem } from "./Item";
import type { HnStory } from "./types";

export const hackerNews: Source<HnStory> = {
	id: "hacker-news",
	name: "Hacker News",
	externalUrl: "https://news.ycombinator.com/",
	brand: "hn",
	cache: { key: "hacker-news", ttlMs: 5 * 60 * 1000 },
	fetch: fetchHackerNews,
	Item: HackerNewsItem,
	Icon: HackerNewsIcon,
};

export type { HnStory } from "./types";
