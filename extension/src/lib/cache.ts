import { backend, NS } from "./storage";

type CachePayload = {
	data: unknown;
	storedAt: number;
};

export async function readCache(key: string, ttlMs: number): Promise<{ data: unknown; isFresh: boolean } | null> {
	const entry = await backend.get<CachePayload>(NS + key);
	if (!entry) return null;
	return { data: entry.data, isFresh: Date.now() - entry.storedAt < ttlMs };
}

export async function writeCache(key: string, data: unknown): Promise<void> {
	await backend.set(NS + key, { data, storedAt: Date.now() } satisfies CachePayload);
}

export async function clearCache(key: string): Promise<void> {
	await backend.remove(NS + key);
}
