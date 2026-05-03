import { useEffect, useRef, useState } from "preact/hooks";
import type { Source } from "../sources/types";
import { readCache, writeCache } from "./cache";

export type SourceDataState<TItem> = {
	items: TItem[] | null;
	isInitialLoad: boolean;
	error: string | null;
};

export function useSourceData<TItem>(source: Source<TItem>): SourceDataState<TItem> {
	const [items, setItems] = useState<TItem[] | null>(null);
	const [isInitialLoad, setIsInitialLoad] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		const ctrl = new AbortController();
		abortRef.current = ctrl;

		const run = async () => {
			const cached = await readCache(source.cache.key, source.cache.ttlMs);
			if (cached) {
				setItems(cached.data as TItem[]);
				setIsInitialLoad(false);
				if (cached.isFresh) return;
			}

			try {
				const fresh = await source.fetch(ctrl.signal);
				if (ctrl.signal.aborted) return;
				setItems(fresh);
				setError(null);
				await writeCache(source.cache.key, fresh);
			} catch (err) {
				if (ctrl.signal.aborted) return;
				const message = err instanceof Error ? err.message : "Unknown error";
				setError(message);
			} finally {
				if (!ctrl.signal.aborted) {
					setIsInitialLoad(false);
				}
			}
		};

		void run();
		return () => ctrl.abort();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return {
		items,
		isInitialLoad,
		error,
	};
}
