// User preferences for contrast and text-size toggles.
// Backed by window.localStorage (not browser.storage.local) so reads are
// synchronous — required by the inline script in index.html that applies
// the saved values before first paint to avoid a flash.

export const PREFS_NS = "hackdrop:prefs:";

export type ContrastMode = "crisp" | "soft";
export type TextSize = "default" | "smaller";

export const CONTRAST_MODES: readonly ContrastMode[] = ["crisp", "soft"];
export const TEXT_SIZES: readonly TextSize[] = ["default", "smaller"];

export const PREF_KEYS = {
	contrast: `${PREFS_NS}contrast`,
	textSize: `${PREFS_NS}text-size`,
} as const;

export function readPref<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return fallback;
		const parsed: unknown = JSON.parse(raw);
		return typeof parsed === "string" && (allowed as readonly string[]).includes(parsed) ? (parsed as T) : fallback;
	} catch {
		return fallback;
	}
}

export function writePref(key: string, value: string): void {
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch {
		/* quota or disabled — ignore */
	}
}
