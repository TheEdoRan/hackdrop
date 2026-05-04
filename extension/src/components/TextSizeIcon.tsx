// Two state-specific icons for the text-size toggle. Both glyphs are
// centered in the 24×24 box via dominant-baseline="central"; only the
// font-size differs between states.

const FONT = "ui-sans-serif, system-ui, sans-serif";

export function TextSizeSmallIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" class={`icon-swap ${className ?? ""}`} aria-hidden="true" fill="currentColor">
			<text
				x="12"
				y="12"
				font-size="14"
				font-weight="700"
				font-family={FONT}
				text-anchor="middle"
				dominant-baseline="central"
			>
				A
			</text>
		</svg>
	);
}

export function TextSizeLargeIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" class={`icon-swap ${className ?? ""}`} aria-hidden="true" fill="currentColor">
			<text
				x="12"
				y="12"
				font-size="22"
				font-weight="700"
				font-family={FONT}
				text-anchor="middle"
				dominant-baseline="central"
			>
				A
			</text>
		</svg>
	);
}
