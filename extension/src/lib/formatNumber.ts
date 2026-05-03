const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const grouped = new Intl.NumberFormat();

export function formatCompact(n: number): string {
	return compact.format(n);
}

export function formatGrouped(n: number): string {
	return grouped.format(n);
}
