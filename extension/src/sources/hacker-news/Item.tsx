import { formatGrouped } from "../../lib/formatNumber";
import { relativeTime } from "../../lib/relativeTime";
import { safeUrl } from "../../lib/safeUrl";
import type { HnStory } from "./types";

export function HackerNewsItem({ item }: { item: HnStory }) {
	return (
		<div class="group hover:bg-hover dark:hover:bg-hover-dk relative px-4 py-3 transition-colors motion-reduce:transition-none">
			<a
				href={safeUrl(item.hnUrl)}
				target="_blank"
				rel="noopener noreferrer"
				class="absolute inset-0"
				aria-label={`${item.title} — Hacker News discussion`}
			/>

			<div class="pointer-events-none relative flex items-baseline gap-2">
				<span class="text-ink group-hover:text-brand-hn dark:text-ink-dk text-[14px] leading-snug">{item.title}</span>
				{item.domain && (
					<a
						href={safeUrl(item.url)}
						target="_blank"
						rel="noopener noreferrer"
						class="num text-ink-3 dark:text-ink-3-dk hover:text-brand-hn pointer-events-auto relative shrink-0 text-[11px]"
					>
						({item.domain})
					</a>
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
				<span>{item.author}</span>
				<span aria-hidden="true">·</span>
				<span>{relativeTime(item.createdAtMs)}</span>
				<span aria-hidden="true">·</span>
				<span>
					{formatGrouped(item.comments)} comment{item.comments === 1 ? "" : "s"}
				</span>
			</div>
		</div>
	);
}
