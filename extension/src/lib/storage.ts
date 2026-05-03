// Resolves the active key/value backend.
// In a real extension context, chrome.storage.local (or browser.storage.local) exists.
// In the Vite dev server, neither does — fall back to localStorage so dev still works.
// We avoid importing webextension-polyfill at the top level because it throws on import
// outside an extension context.

export type StorageBackend = {
	supportsSync: boolean;
	get<T>(key: string): Promise<T | undefined>;
	// Only meaningful when `supportsSync` is true; otherwise always returns undefined.
	getSync(key: string): unknown;
	set(key: string, value: unknown): Promise<void>;
	remove(key: string): Promise<void>;
};

function readLocalSync(key: string): unknown {
	try {
		const raw = window.localStorage.getItem(key);
		return raw ? JSON.parse(raw) : undefined;
	} catch {
		return undefined;
	}
}

function makeBackend(): StorageBackend {
	const ext =
		(globalThis as { chrome?: typeof chrome; browser?: typeof browser }).browser?.storage?.local ??
		(globalThis as { chrome?: typeof chrome }).chrome?.storage?.local;

	if (ext) {
		return {
			supportsSync: false,
			async get<T>(key: string) {
				const r = (await ext.get(key)) as Record<string, unknown>;
				return r[key] as T | undefined;
			},
			getSync(_key: string) {
				return undefined;
			},
			async set(key: string, value: unknown) {
				await ext.set({ [key]: value });
			},
			async remove(key: string) {
				await ext.remove(key);
			},
		};
	}

	return {
		supportsSync: true,
		async get<T>(key: string) {
			return readLocalSync(key) as T | undefined;
		},
		getSync(key: string) {
			return readLocalSync(key);
		},
		async set(key: string, value: unknown) {
			try {
				window.localStorage.setItem(key, JSON.stringify(value));
			} catch {
				/* quota or disabled — ignore */
			}
		},
		async remove(key: string) {
			window.localStorage.removeItem(key);
		},
	};
}

export const NS = "hackdrop:";
export const backend = makeBackend();
