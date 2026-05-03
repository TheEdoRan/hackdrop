import { formatGrouped } from "../../lib/formatNumber";
import { relativeTime } from "../../lib/relativeTime";
import { safeUrl } from "../../lib/safeUrl";
import type { HnStory } from "./types";

export function HackerNewsItem({ item }: { item: HnStory }) {
	const userUrl = `https://news.ycombinator.com/user?id=${encodeURIComponent(item.author)}`;
	const commentsLabel = `${formatGrouped(item.comments)} comment${item.comments === 1 ? "" : "s"}`;

	return (
		<div class="group hover:bg-hover dark:hover:bg-hover-dk relative px-4 py-3 transition-colors motion-reduce:transition-none">
			<a
				href={safeUrl(item.url)}
				target="_blank"
				rel="noopener noreferrer"
				class="absolute inset-0"
				aria-label={item.domain ? `${item.title} — ${item.domain}` : item.title}
			/>

			<div class="pointer-events-none relative flex items-baseline gap-2">
				<span class="text-ink dark:text-ink-dk text-[14px] leading-snug">{item.title}</span>
				{item.domain && (
					<span class="num text-ink-3 dark:text-ink-3-dk group-hover:text-brand-hn shrink-0 text-[11px]">
						({item.domain})
					</span>
				)}
			</div>

			<div class="num text-ink-3 dark:text-ink-3-dk pointer-events-none mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px]">
				<span class="text-ink-2 dark:text-ink-2-dk inline-flex items-center gap-1">
					<span class="text-brand-hn/75" aria-hidden="true">
						▲
					</span>
					{formatGrouped(item.score)}
				</span>
				<span aria-hidden="true">·</span>
				<a
					href={safeUrl(userUrl)}
					target="_blank"
					rel="noopener noreferrer"
					class="hover:text-brand-hn pointer-events-auto relative"
					aria-label={`${item.author} on Hacker News`}
				>
					{item.author}
				</a>
				<span aria-hidden="true">·</span>
				<a
					href={safeUrl(item.hnUrl)}
					target="_blank"
					rel="noopener noreferrer"
					class="hover:text-brand-hn pointer-events-auto relative"
					aria-label="Hacker News discussion"
				>
					{relativeTime(item.createdAtMs)}
				</a>
				<span aria-hidden="true">·</span>
				<a
					href={safeUrl(item.hnUrl)}
					target="_blank"
					rel="noopener noreferrer"
					class="hover:text-brand-hn pointer-events-auto relative"
				>
					{commentsLabel}
				</a>
			</div>
		</div>
	);
}
