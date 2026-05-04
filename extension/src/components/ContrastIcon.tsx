// Two state-specific icons for the contrast toggle. Both icons render
// the same pair of horizontal bars; what differs is the *opacity gap*
// between them — that gap is itself a literal picture of contrast.
//
// Crisp: top bar at full ink, bottom bar very faint → big gap = high contrast.
// Soft : both bars at the same mid opacity → no gap = low contrast.

export function CrispIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" class={`icon-swap ${className ?? ""}`} aria-hidden="true" fill="currentColor">
			<rect x="3" y="5" width="18" height="6" rx="1.25" />
			<rect x="3" y="13" width="18" height="6" rx="1.25" opacity="0.25" />
		</svg>
	);
}

export function SoftIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" class={`icon-swap ${className ?? ""}`} aria-hidden="true" fill="currentColor">
			<rect x="3" y="5" width="18" height="6" rx="1.25" opacity="0.6" />
			<rect x="3" y="13" width="18" height="6" rx="1.25" opacity="0.6" />
		</svg>
	);
}
