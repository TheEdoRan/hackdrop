const formatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

const UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
	{ unit: "year", ms: 365.25 * 24 * 60 * 60 * 1000 },
	{ unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
	{ unit: "week", ms: 7 * 24 * 60 * 60 * 1000 },
	{ unit: "day", ms: 24 * 60 * 60 * 1000 },
	{ unit: "hour", ms: 60 * 60 * 1000 },
	{ unit: "minute", ms: 60 * 1000 },
	{ unit: "second", ms: 1000 },
];

export function relativeTime(timestampMs: number, now: number = Date.now()): string {
	const diff = timestampMs - now;
	for (const { unit, ms } of UNITS) {
		if (Math.abs(diff) >= ms || unit === "second") {
			return formatter.format(Math.round(diff / ms), unit);
		}
	}
	return formatter.format(0, "second");
}
