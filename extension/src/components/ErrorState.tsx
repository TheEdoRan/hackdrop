export function ErrorState({ message }: { message: string }) {
	return (
		<div class="text-ink-2 dark:text-ink-2-dk flex flex-col items-start gap-3 px-4 py-6 text-sm">
			<p>
				<span class="text-accent dark:text-accent-dk">Couldn’t load.</span>{" "}
				<span class="text-ink-3 dark:text-ink-3-dk">{message}</span>
			</p>
		</div>
	);
}
