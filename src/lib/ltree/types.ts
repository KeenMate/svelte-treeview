import type { Index } from 'flexsearch';
import type { LTreeNode } from './ltree-node.svelte';

export type Tuple<T, U> = [T, U];

export interface Ltree<T> {
	// Properties (readonly getters)
	treePathSeparator: string;

	root: LTreeNode<T>;

	changeTracker: Symbol | undefined;

	idMember: string | null | undefined;
	pathMember: string | null | undefined;
	parentPathMember: string | null | undefined;
	levelMember: string | null | undefined;

	hasChildrenMember: string | null | undefined;
	isExpandedMember: string | null | undefined;

	displayValueMember?: string | null | undefined;
	getDisplayValueCallback?: (node: LTreeNode<T>) => string;

	searchValueMember?: string | null | undefined;
	getSearchValueCallback?: (node: LTreeNode<T>) => string;

	isSorted: boolean | null | undefined;
	sortCallback?: (items: LTreeNode<T>[]) => LTreeNode<T>[];

	indexingCompleteCallback?: () => void;

	// Filtering properties
	filteredTree: LTreeNode<T>[] | null;
	isFiltered: boolean;

	isSelectableMember: string | null | undefined;
	isDraggableMember: string | null | undefined;
	isDropAllowedMember: string | null | undefined;

	shouldDisplayDebugInformation: boolean | null | undefined;

	// Methods
	get tree(): LTreeNode<T>[];
	get statistics(): { nodeCount: number; maxLevel: number };

	insertArray(data: T[]): void;

	insertTreeNode(parentPath: string, newNode: LTreeNode<T>, noEmitChanges?: boolean): string | null;

	filterNodes(_searchText: string): void;

	createFilteredTree(targetPaths: string[]): void;

	clearFilter(): void;

	expandAll(nodePath?: string | null | undefined): void;
	collapseAll(nodePath?: string | null | undefined): void;

	insert(path: string, data: T, noEmitChanges?: boolean): void;

	getNodeByPath(path: string): LTreeNode<T> | null;

	expandNodes(path: string): Ltree<T>; // Returns self for chaining

	collapseNodes(path: string): Ltree<T>; // Returns self for chaining

	getNodeDisplayValue(node: LTreeNode<T>): string;

	getNodeSearchValue(node: LTreeNode<T>): string;

	_defaultSort(self: Ltree<T>, items: LTreeNode<T>[]): LTreeNode<T>[];

	_emitTreeChanged(): void;

	refresh(): void;
}
