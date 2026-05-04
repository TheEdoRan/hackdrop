import type { ComponentChildren, ComponentType } from "preact";
import type { SourceDataPhase } from "../lib/useSourceData";
import type { SourceMeta } from "../sources/types";
import { ErrorState } from "./ErrorState";
import { ExternalLinkIcon } from "./ExternalLinkIcon";
import { ItemSkeletonList } from "./ItemSkeleton";

export type ColumnCardProps<TItem> = {
	source: SourceMeta;
	items: TItem[] | null;
	phase: SourceDataPhase;
	error: string | null;
	Item: ComponentType<{ item: TItem }>;
	className?: string;
	headerSlot?: ComponentChildren;
};

export function ColumnCard<TItem>({
	source,
	items,
	phase,
	error,
	Item,
	className = "flex",
	headerSlot,
}: ColumnCardProps<TItem>) {
	return (
		<section class={`relative min-h-0 min-w-0 flex-col ${className}`} aria-label={source.name}>
			<ColumnHeader source={source} headerSlot={headerSlot} />

			{headerSlot && (
				<div class="border-ink/20 dark:border-ink-dk/20 flex items-center justify-end border-b px-4 py-2 md:hidden">
					{headerSlot}
				</div>
			)}

			<div class="scroll-area min-h-0 flex-1 overflow-y-auto">
				{error && (!items || items.length === 0) && <ErrorState message={error} />}

				{!error && phase === "fetching-fresh" && <ItemSkeletonList />}

				{!error && phase === "ready" && (items === null || items.length === 0) && (
					<div class="text-ink-3 dark:text-ink-3-dk px-4 py-6 text-sm">
						Nothing to show right now. Try again in a moment.
					</div>
				)}

				{items && items.length > 0 && (
					<ul class="stagger divide-rule dark:divide-rule-dk divide-y">
						{items.map((item, i) => (
							<li key={i} style={`animation-delay:${Math.min(i, 12) * 30}ms`}>
								<Item item={item} />
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}

function ColumnHeader({ source, headerSlot }: { source: SourceMeta; headerSlot?: ComponentChildren }) {
	const accentClass = source.brand === "github" ? "text-brand-github dark:text-brand-github-dk" : "text-brand-hn";

	return (
		<header class="relative hidden md:block">
			<div class="flex items-center gap-2.5 px-4 py-2.5">
				<source.Icon className={`size-4 shrink-0 ${accentClass}`} />

				<h2 class="num text-ink dark:text-ink-dk text-[13px] font-medium tracking-[0.16em] uppercase">{source.name}</h2>

				{headerSlot && <div class="ml-4">{headerSlot}</div>}

				<a
					href={source.externalUrl}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={`Open ${source.name}`}
					class="text-ink-3 hover:text-ink dark:text-ink-3-dk dark:hover:text-ink-dk ml-auto rounded-sm p-1 transition-colors motion-reduce:transition-none"
				>
					<ExternalLinkIcon className="size-3.5" />
				</a>
			</div>

			<div class="border-ink/20 dark:border-ink-dk/20 border-t" />
		</header>
	);
}
