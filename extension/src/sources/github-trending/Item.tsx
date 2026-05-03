import { formatCompact, formatGrouped } from "../../lib/formatNumber";
import type { TrendingRepo } from "./types";

export function GitHubTrendingItem({ item }: { item: TrendingRepo }) {
	return (
		<a
			href={item.url}
			target="_blank"
			rel="noopener noreferrer"
			class="group hover:bg-hover dark:hover:bg-hover-dk relative block px-4 py-3 transition-colors motion-reduce:transition-none"
		>
			<div class="num flex items-baseline gap-1 text-[14px]">
				<span class="text-ink-2 dark:text-ink-2-dk">{item.owner}</span>
				<span class="text-ink-3 dark:text-ink-3-dk">/</span>
				<span class="text-ink group-hover:text-accent dark:text-ink-dk dark:group-hover:text-accent-dk">
					{item.name}
				</span>
			</div>

			{item.description && (
				<p class="text-ink-2 dark:text-ink-2-dk mt-1.5 line-clamp-2 text-[13px] leading-snug">{item.description}</p>
			)}

			<div class="num text-ink-3 dark:text-ink-3-dk mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px]">
				{item.language && (
					<span class="inline-flex items-center gap-1.5">
						<span
							class="ring-rule dark:ring-rule-dk size-2 rounded-full ring-1"
							style={{ backgroundColor: item.languageColor ?? "transparent" }}
							aria-hidden="true"
						/>
						{item.language}
					</span>
				)}

				<Metric icon={<StarIcon />} label={`${formatGrouped(item.stars)} stars`}>
					{formatCompact(item.stars)}
				</Metric>

				<Metric icon={<ForkIcon />} label={`${formatGrouped(item.forks)} forks`}>
					{formatCompact(item.forks)}
				</Metric>

				{item.starsToday > 0 && (
					<span class="text-accent dark:text-accent-dk ml-auto inline-flex items-center gap-1">
						<StarIcon />+{formatGrouped(item.starsToday)}
					</span>
				)}
			</div>
		</a>
	);
}

function Metric({
	icon,
	label,
	children,
}: {
	icon: preact.ComponentChild;
	label: string;
	children: preact.ComponentChild;
}) {
	return (
		<span class="inline-flex items-center gap-1" aria-label={label} title={label}>
			{icon}
			{children}
		</span>
	);
}

function StarIcon() {
	return (
		<svg viewBox="0 0 16 16" class="size-3 fill-current" aria-hidden="true">
			<path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
		</svg>
	);
}

function ForkIcon() {
	return (
		<svg viewBox="0 0 16 16" class="size-3 fill-current" aria-hidden="true">
			<path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z" />
		</svg>
	);
}
