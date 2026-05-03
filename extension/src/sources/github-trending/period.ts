import { backend, NS } from "../../lib/storage";

export type Period = "daily" | "weekly" | "monthly";

export const PERIODS: readonly Period[] = ["daily", "weekly", "monthly"];
export const DEFAULT_PERIOD: Period = "daily";

const STORAGE_KEY = NS + "github-trending:period";

function isPeriod(value: unknown): value is Period {
	return value === "daily" || value === "weekly" || value === "monthly";
}

export async function readPeriod(): Promise<Period> {
	const stored = await backend.get<unknown>(STORAGE_KEY);
	return isPeriod(stored) ? stored : DEFAULT_PERIOD;
}

// Sync read for backends that support it (localStorage in dev). Returns null for
// backends that can't read sync (chrome.storage in production) so the caller knows
// it must fall back to async hydration.
export function readPeriodSync(): Period | null {
	if (!backend.supportsSync) return null;
	const stored = backend.getSync(STORAGE_KEY);
	return isPeriod(stored) ? stored : DEFAULT_PERIOD;
}

export async function writePeriod(period: Period): Promise<void> {
	await backend.set(STORAGE_KEY, period);
}
