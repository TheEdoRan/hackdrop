import { type Period, PERIODS } from "./period";

const LABELS: Record<Period, { abbr: string; full: string }> = {
	daily: { abbr: "D", full: "Daily" },
	weekly: { abbr: "W", full: "Weekly" },
	monthly: { abbr: "M", full: "Monthly" },
};

export function PeriodFilter({ value, onChange }: { value: Period | null; onChange: (period: Period) => void }) {
	return (
		<div
			role="tablist"
			aria-label="Trending period"
			class="num flex items-center gap-2 text-[0.75rem] font-medium uppercase"
		>
			{PERIODS.map((p) => {
				const isActive = p === value;
				const { abbr, full } = LABELS[p];
				return (
					<button
						key={p}
						type="button"
						role="tab"
						aria-selected={isActive}
						aria-label={full}
						title={full}
						onClick={() => onChange(p)}
						class={`text-ink dark:text-ink-dk -mb-px border-b transition-opacity motion-reduce:transition-none ${
							isActive ? "border-current opacity-100" : "border-transparent opacity-40 hover:opacity-80"
						}`}
					>
						{abbr}
					</button>
				);
			})}
		</div>
	);
}
