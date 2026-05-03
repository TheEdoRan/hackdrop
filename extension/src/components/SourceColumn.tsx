import { useSourceData } from "../lib/useSourceData";
import type { Source } from "../sources/types";
import { ColumnCard } from "./ColumnCard";

export function SourceColumn<TItem>({ source, className }: { source: Source<TItem>; className?: string }) {
	const { items, isInitialLoad, error } = useSourceData(source);

	return (
		<ColumnCard
			source={source}
			items={items}
			isInitialLoad={isInitialLoad}
			error={error}
			Item={source.Item}
			className={className}
		/>
	);
}
