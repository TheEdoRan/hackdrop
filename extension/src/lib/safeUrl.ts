const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

export function safeUrl(raw: string | null | undefined, fallback = "#"): string {
	if (!raw) return fallback;
	try {
		const u = new URL(raw);
		return ALLOWED_SCHEMES.has(u.protocol) ? u.toString() : fallback;
	} catch {
		return fallback;
	}
}
