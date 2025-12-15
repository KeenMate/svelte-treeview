import type { Index, SearchOptions } from 'flexsearch';
import type { LTreeNode } from './ltree-node.svelte';

export type Tuple<T, U> = [T, U];

// Drag and drop types
export type DropPosition = 'above' | 'below' | 'child';
export type DragDropMode = 'none' | 'self' | 'cross' | 'both';
export type DropZoneLayout = 'around' | 'above' | 'below' | 'wave' | 'wave2';
export type DropOperation = 'move' | 'copy';

// Incremental update types
export type TreeChange<T> =
	| { operation: 'create'; parentPath: string; data: T; pathSegment?: string }
	| { operation: 'update'; path: string; data: Partial<T> }
	| { operation: 'delete'; path: string };

export interface ApplyChangesResult {
	successful: number;
	failed: Array<{ index: number; operation: string; path: string; error: string }>;
}

export interface ContextMenuItem {
	icon?: string;
	title: string;
	isDisabled?: boolean;
	callback: () => void | Promise<void>;
	isDivider?: boolean;
	className?: string;
}

export interface InsertArrayResult<T> {
	successful: number;
	failed: Array<{
		node: LTreeNode<T>;
		originalData: T;
		error: string;
	}>;
	total: number;
}

export interface Ltree<T> {
	// Properties (readonly getters)
	treePathSeparator: string;

	root: LTreeNode<T>;
	filteredRoot: LTreeNode<T>;

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

	// For sibling ordering in drag-drop (above/below positioning)
	orderMember?: string | null | undefined;

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

	insertArray(data: T[]): InsertArrayResult<T>;

	insertTreeNode(parentPath: string, newNode: LTreeNode<T>, noEmitChanges?: boolean): string | null;

	filterNodes(_searchText: string, _searchOptions?: SearchOptions): void;

	searchNodes(_searchText: string | null | undefined, _searchOptions?: SearchOptions): LTreeNode<T>[];

	createFilteredTree(targetPaths: string[]): void;

	clearFilter(): void;

	expandAll(nodePath?: string | null | undefined): void;
	collapseAll(nodePath?: string | null | undefined): void;

	insert(path: string, data: T, noEmitChanges?: boolean): void;

	getNodeByPath(path: string, _root?: LTreeNode<T> | null | undefined): LTreeNode<T> | null;

	expandNodes(path: string): Ltree<T>; // Returns self for chaining

	collapseNodes(path: string): Ltree<T>; // Returns self for chaining

	getNodeDisplayValue(node: LTreeNode<T>): string;

	getNodeSearchValue(node: LTreeNode<T>): string;

	_defaultSort(self: Ltree<T>, items: LTreeNode<T>[]): LTreeNode<T>[];

	_emitTreeChanged(): void;

	refresh(): void;

	// Partial refresh methods for tree editor support
	getChildren(parentPath: string): LTreeNode<T>[];
	getSiblings(path: string): LTreeNode<T>[];
	refreshSiblings(parentPath: string): void;
	refreshNode(path: string): void;

	// Tree editor mutation methods
	moveNode(sourcePath: string, targetPath: string, position: 'above' | 'below' | 'child'): { success: boolean; error?: string };
	removeNode(path: string, includeDescendants?: boolean): { success: boolean; node?: LTreeNode<T>; error?: string };
	addNode(parentPath: string, data: T, pathSegment?: string): { success: boolean; node?: LTreeNode<T>; error?: string };
	updateNode(path: string, dataUpdates: Partial<T>): { success: boolean; node?: LTreeNode<T>; error?: string };
	applyChanges(changes: TreeChange<T>[]): ApplyChangesResult;

	// Internal helpers
	_updateDescendantPaths(node: LTreeNode<T>, oldBasePath: string, newBasePath: string): void;
}
