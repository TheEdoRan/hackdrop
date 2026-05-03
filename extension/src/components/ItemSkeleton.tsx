export function ItemSkeleton() {
	return (
		<div class="space-y-2 px-5 py-4">
			<div class="bg-rule dark:bg-rule-dk h-3.5 w-3/4 animate-pulse rounded" />
			<div class="bg-rule dark:bg-rule-dk h-3 w-full animate-pulse rounded" />
			<div class="bg-rule dark:bg-rule-dk h-3 w-2/3 animate-pulse rounded" />
		</div>
	);
}

export function ItemSkeletonList({ count = 6 }: { count?: number }) {
	return (
		<ul class="divide-rule dark:divide-rule-dk divide-y" aria-hidden="true">
			{Array.from({ length: count }).map((_, i) => (
				<li key={i}>
					<ItemSkeleton />
				</li>
			))}
		</ul>
	);
}
