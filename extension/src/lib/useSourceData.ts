import { useEffect, useRef, useState } from "preact/hooks";
import type { Source } from "../sources/types";
import { readCache, writeCache } from "./cache";

export type SourceDataPhase = "checking-cache" | "fetching-fresh" | "ready";

export type SourceDataState<TItem> = {
	items: TItem[] | null;
	phase: SourceDataPhase;
	error: string | null;
};

export function useSourceData<TItem>(source: Source<TItem>): SourceDataState<TItem> {
	const [items, setItems] = useState<TItem[] | null>(null);
	const [phase, setPhase] = useState<SourceDataPhase>("checking-cache");
	const [error, setError] = useState<string | null>(null);

	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		const ctrl = new AbortController();
		abortRef.current = ctrl;

		const run = async () => {
			const cached = await readCache(source.cache.key, source.cache.ttlMs);
			if (ctrl.signal.aborted) return;
			if (cached) {
				setItems(cached.data as TItem[]);
				setPhase("ready");
				if (cached.isFresh) return;
			} else {
				setPhase("fetching-fresh");
			}

			try {
				const fresh = await source.fetch(ctrl.signal);
				if (ctrl.signal.aborted) return;
				// Skip writing on empty results so a transient upstream blip can't
				// poison a good stale cache or wipe currently-rendered items.
				// ColumnCard's empty-state branch handles the cold-start case.
				if (fresh.length > 0) {
					setItems(fresh);
					setError(null);
					await writeCache(source.cache.key, fresh);
				}
			} catch (err) {
				if (ctrl.signal.aborted) return;
				const detail = err instanceof Error ? err.message : String(err);
				console.warn(`[hackdrop:${source.id}] fetch failed:`, detail);
				setError("Try again later.");
			} finally {
				if (!ctrl.signal.aborted) {
					setPhase("ready");
				}
			}
		};

		void run();
		return () => ctrl.abort();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return {
		items,
		phase,
		error,
	};
}
