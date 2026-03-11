/**
 * Navigation interface — each renderer provides its own implementation.
 * The HTML tree uses flat-list traversal; canvas renderers use spatial logic.
 * Users can override individual methods via TreeNavigationOverrides.
 */
export interface TreeNavigation<T> {
	/** Select a node and scroll it into view (core navigation primitive) */
	navTo(path: string): void;
	/** Move to next visible node at the same level */
	navNextSibling(): void;
	/** Move to previous visible node at the same level */
	navPrevSibling(): void;
	/** Move to first child (expands if collapsed) */
	navInto(): void;
	/** Move to parent node (no collapse) */
	navOut(): void;
	/** Collapse parent and select it (Backspace behavior) */
	navBackOut(): void;
	/** Toggle expand/collapse of current node */
	navToggle(): void;
	/** Select first visible node */
	navFirst(): void;
	/** Select last visible node */
	navLast(): void;
}

export type TreeNavigationOverrides<T> = Partial<TreeNavigation<T>>;
