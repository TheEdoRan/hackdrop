import { useSourceData } from "../lib/useSourceData";
import type { Source } from "../sources/types";
import { ColumnCard } from "./ColumnCard";

export function SourceColumn<TItem>({ source, className }: { source: Source<TItem>; className?: string }) {
	const { items, phase, error } = useSourceData(source);

	return (
		<ColumnCard
			source={source}
			items={items}
			phase={phase}
			error={error}
			Item={source.Item}
			className={className}
		/>
	);
}
