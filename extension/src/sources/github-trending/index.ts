import type { SourceMeta } from "../types";
import { GitHubIcon } from "./Icon";

export const githubTrending: SourceMeta = {
	id: "github-trending",
	name: "GitHub Trending",
	externalUrl: "https://github.com/trending",
	brand: "github",
	Icon: GitHubIcon,
};

export type { TrendingRepo } from "./types";
