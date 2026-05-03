import { useEffect, useState } from "preact/hooks";
import { readCache, writeCache } from "../../lib/cache";
import { fetchTrending } from "./fetch";
import { type Period, readPeriod, readPeriodSync, writePeriod } from "./period";
import type { TrendingRepo } from "./types";

const TTL_MS = 10 * 60 * 1000;

function cacheKey(period: Period): string {
	return `github-trending:${period}`;
}

export type TrendingState = {
	items: TrendingRepo[] | null;
	isInitialLoad: boolean;
	error: string | null;
	// `null` while the persisted period is being loaded async (chrome.storage backend).
	// The filter UI renders with no tab selected during this brief window so we never
	// flash the default before snapping to the user's choice.
	period: Period | null;
	setPeriod: (period: Period) => void;
};

export function useTrending(): TrendingState {
	const [period, setPeriodState] = useState<Period | null>(() => readPeriodSync());
	const [items, setItems] = useState<TrendingRepo[] | null>(null);
	const [isInitialLoad, setIsInitialLoad] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (period !== null) return;
		let cancelled = false;
		void readPeriod().then((p) => {
			if (!cancelled) setPeriodState(p);
		});
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (period === null) return;
		const ctrl = new AbortController();

		const run = async () => {
			const cached = await readCache(cacheKey(period), TTL_MS);
			if (ctrl.signal.aborted) return;
			if (cached) {
				setItems(cached.data as TrendingRepo[]);
				setIsInitialLoad(false);
				if (cached.isFresh) return;
			} else {
				setItems(null);
				setIsInitialLoad(true);
			}

			try {
				const fresh = await fetchTrending(period, ctrl.signal);
				if (ctrl.signal.aborted) return;
				setItems(fresh);
				setError(null);
				await writeCache(cacheKey(period), fresh);
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
	}, [period]);

	const setPeriod = (next: Period) => {
		if (next === period) return;
		setError(null);
		setPeriodState(next);
		void writePeriod(next);
	};

	return {
		items,
		isInitialLoad,
		error,
		period,
		setPeriod,
	};
}
