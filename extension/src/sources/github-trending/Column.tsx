import { githubTrending } from ".";
import { ColumnCard } from "../../components/ColumnCard";
import { GitHubTrendingItem } from "./Item";
import { PeriodFilter } from "./PeriodFilter";
import { useTrending } from "./useTrending";

export function GithubTrendingColumn({ className }: { className?: string }) {
	const { items, isInitialLoad, error, period, setPeriod } = useTrending();

	return (
		<ColumnCard
			source={githubTrending}
			items={items}
			isInitialLoad={isInitialLoad}
			error={error}
			Item={GitHubTrendingItem}
			className={className}
			headerSlot={<PeriodFilter value={period} onChange={setPeriod} />}
		/>
	);
}
