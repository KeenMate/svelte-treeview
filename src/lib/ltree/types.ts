import type { Index, SearchOptions } from 'flexsearch';
import type { LTreeNode, DropPosition } from './ltree-node.svelte.js';

// Re-export LTreeNode and DropPosition for convenience
export type { LTreeNode, DropPosition } from './ltree-node.svelte.js';

export type Tuple<T, U> = [T, U];
export type DragDropMode = 'none' | 'self' | 'cross' | 'both';
export type ToggleIconMode = 'rotate' | 'swap';
export type ClickBehavior = 'select' | 'expand' | 'expand-and-focus';
export type CheckboxMode = 'independent' | 'cascade';
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

// ── Context Menu Types ──────────────────────────────────────────────────

export interface ContextMenuDivider {
	divider: true;
	label?: string; // named divider: ──── [label] ────
}

export interface ContextMenuItem {
	id?: string;
	label: string;
	icon?: string;
	shortcut?: string;
	isDisabled?: boolean;
	isVisible?: boolean; // false = skip rendering (callback approach)
	className?: string; // e.g. "danger" for red styling
	onclick?: () => void | Promise<void>;
	children?: ContextMenuEntry[]; // nested submenus
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuDivider;

export interface InsertArrayResult<T> {
	successful: number;
	failed: Array<{
		node: LTreeNode<T>;
		originalData: T;
		error: string;
	}>;
	total: number;
}

export interface InsertBranchResult<T> {
	success: boolean;
	count: number;
	failed: Array<{ data: T; error: string }>;
	parentNode: LTreeNode<T> | null;
}

export interface DeleteBranchResult<T> {
	success: boolean;
	removedCount: number;
	error?: string;
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

	// For sibling ordering in drag-drop (before/after positioning)
	orderMember?: string | null | undefined;

	isSorted: boolean | null | undefined;
	sortCallback?: (items: LTreeNode<T>[]) => LTreeNode<T>[];

	indexingCompleteCallback?: () => void;

	// Filtering properties
	filteredTree: LTreeNode<T>[] | null;
	isFiltered: boolean;

	isSelectableMember: string | null | undefined;
	isDraggableMember: string | null | undefined;
	getIsDraggableCallback?: (node: LTreeNode<T>) => boolean;
	isDropAllowedMember: string | null | undefined;
	allowedDropPositionsMember: string | null | undefined;
	getAllowedDropPositionsCallback?: (node: LTreeNode<T>) => DropPosition[] | null | undefined;
	isCollapsibleMember: string | null | undefined;
	getIsCollapsibleCallback?: (node: LTreeNode<T>) => boolean;

	shouldDisplayDebugInformation: boolean | null | undefined;

	// Method to get allowed drop positions (uses callback or member)
	getNodeAllowedDropPositions(node: LTreeNode<T>): DropPosition[] | null | undefined;
	getNodeIsDraggable(node: LTreeNode<T>): boolean;
	getNodeIsCollapsible(node: LTreeNode<T>): boolean;

	// Methods
	get tree(): LTreeNode<T>[];
	/** Flat array of all visible nodes in render order (depth-first, respects isExpanded) */
	get visibleFlatNodes(): LTreeNode<T>[];
	get statistics(): { nodeCount: number; maxLevel: number; filteredNodeCount: number; isIndexing: boolean; pendingIndexCount: number };

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
	moveNode(sourcePath: string, targetPath: string, position: 'before' | 'after' | 'child'): { success: boolean; error?: string };
	removeNode(path: string, includeDescendants?: boolean): { success: boolean; node?: LTreeNode<T>; error?: string };
	addNode(parentPath: string, data: T, pathSegment?: string): { success: boolean; node?: LTreeNode<T>; error?: string };
	updateNode(path: string, dataUpdates: Partial<T>): { success: boolean; node?: LTreeNode<T>; error?: string };
	applyChanges(changes: TreeChange<T>[]): ApplyChangesResult;

	// Bulk subtree operations (single emission)
	insertBranch(parentPath: string, data: T[]): InsertBranchResult<T>;
	replaceBranch(parentPath: string, data: T[]): InsertBranchResult<T>;
	deleteBranch(path: string, keepParent?: boolean): DeleteBranchResult<T>;

	// Cross-tree copy method
	copyNodeWithDescendants(
		sourceNode: LTreeNode<T>,
		targetParentPath: string,
		transformData: (data: T) => T,
		siblingPath?: string,
		position?: 'before' | 'after'
	): { success: boolean; rootNode?: LTreeNode<T>; count: number; error?: string };

	// State persistence methods
	getExpandedPaths(): string[];
	setExpandedPaths(paths: string[]): void;
	getAllData(): T[];

	// Internal helpers
	_updateDescendantPaths(node: LTreeNode<T>, oldBasePath: string, newBasePath: string): void;
}
