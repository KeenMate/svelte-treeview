import type { Index } from "flexsearch";
import FlexSearch, { Charset } from "flexsearch";

export function createSearchIndex(): Index {
	return new FlexSearch.Index({
		tokenize: "full", // Good for most use cases
		resolution: 9, // High resolution for better accuracy
		encoder: Charset.Normalize
	});
}
