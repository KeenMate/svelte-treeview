import type { Index, SearchOptions } from 'flexsearch';
import type { LTreeNode, DropPosition } from './ltree-node.svelte.js';

// Re-export LTreeNode and DropPosition for convenience
export type { LTreeNode, DropPosition } from './ltree-node.svelte.js';

export type DragDropMode = 'none' | 'self' | 'cross' | 'both';
export type ToggleIconMode = 'rotate' | 'swap';
/**
 * How the built-in node label (`.stv__node-label`) behaves when it's wider than the
 * available row space:
 * - `wrap` (default): the label wraps onto multiple lines — the row grows taller.
 * - `ellipsis`: the label stays on one line and is clipped with an ellipsis (…).
 * - `info`: like `ellipsis`, but a trailing circled-ⓘ affordance appears ONLY on rows
 *   whose label is actually clipped; clicking it reveals the full label in a popover
 *   (the touch/no-hover substitute for the native `title` tooltip, which is also set).
 * Only affects the default label render path; a `nodeTemplate` snippet owns its own layout.
 */
export type NodeTitleOverflow = 'wrap' | 'ellipsis' | 'info';
export type ClickBehavior = 'select' | 'expand' | 'expand-and-focus';
export type CheckboxMode = 'independent' | 'cascade';
/**
 * Which paths the checkbox selection EMITS (via `selectedPaths` + `onSelectionChange`)
 * when `checkboxMode === 'cascade'`. Orthogonal to `checkboxMode` (which controls the
 * cascade BEHAVIOUR); this controls the projected OUTPUT. Ignored in `'independent'` mode
 * (there the emitted set is the raw toggled set).
 * - `'rolled-up'` (default): minimal cover — a fully-checked subtree collapses to its root;
 *   a partially-checked branch emits its individually-checked descendants.
 * - `'leaves'`: only the checked leaf nodes.
 * - `'all'`: every fully-checked node (branches + leaves).
 */
export type CascadeSelectPolicy = 'rolled-up' | 'leaves' | 'all';
export type SelectionMode = 'single' | 'multi';
/** Gesture mode for highlightNode(): replace = plain click, toggle = Ctrl+click, range = Shift+click. */
export type HighlightMode = 'replace' | 'toggle' | 'range';
/** Options shared by every imperative selection/highlight/focus mutator. */
export interface TreeMutationOptions {
	/** Update state without firing onNodeClick / onHighlightChange / onSelectionChange
	 *  (e.g. when restoring state from URL params or other external sources). */
	silent?: boolean;
}
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
	/**
	 * Whether activating this item auto-closes the menu. Default `true` —
	 * selecting an entry dismisses the menu like every native/desktop menu.
	 * Set `false` for items that act incrementally (toggle a flag, run a
	 * multi-step action) and want the menu to stay open; the handler is then
	 * responsible for dismissing it via the `close` callback passed to
	 * getContextMenuItemsCallback (or the snippet's close prop).
	 */
	shouldCloseOnClick?: boolean;
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
	getIsExpandedCallback?: (node: LTreeNode<T>) => boolean;

	displayValueMember?: string | null | undefined;
	getDisplayValueCallback?: (node: LTreeNode<T>) => string;
	/** Text returned by getNodeDisplayValue when neither displayValueMember nor
	 *  getDisplayValueCallback resolves a value (default '[N/A]'). */
	displayValueFallback?: string;

	searchValueMember?: string | null | undefined;
	getSearchValueCallback?: (node: LTreeNode<T>) => string;

	// For sibling ordering in drag-drop (before/after positioning)
	orderMember?: string | null | undefined;

	isSorted: boolean | null | undefined;
	sortCallback?: (items: LTreeNode<T>[]) => LTreeNode<T>[];

	// Filtering properties
	filteredTree: LTreeNode<T>[] | null;
	isFiltered: boolean;

	isSelectableMember: string | null | undefined;
	getIsSelectableCallback?: (node: LTreeNode<T>) => boolean;
	isSelectedMember: string | null | undefined;
	getIsSelectedCallback?: (node: LTreeNode<T>) => boolean;
	isDraggableMember: string | null | undefined;
	getIsDraggableCallback?: (node: LTreeNode<T>) => boolean;
	isDropAllowedMember: string | null | undefined;
	getIsDropAllowedCallback?: (node: LTreeNode<T>) => boolean;
	allowedDropPositionsMember: string | null | undefined;
	getAllowedDropPositionsCallback?: (node: LTreeNode<T>) => DropPosition[] | null | undefined;
	isCollapsibleMember: string | null | undefined;
	getIsCollapsibleCallback?: (node: LTreeNode<T>) => boolean;

	shouldDisplayDebugInformation: boolean | null | undefined;

	// Method to get allowed drop positions (uses callback or member)
	getNodeAllowedDropPositions(node: LTreeNode<T>): DropPosition[] | null | undefined;
	getNodeIsDraggable(node: LTreeNode<T>): boolean;
	getNodeIsDropAllowed(node: LTreeNode<T>): boolean;
	getNodeIsCollapsible(node: LTreeNode<T>): boolean;

	// Methods
	get tree(): LTreeNode<T>[];
	/** Flat array of all visible nodes in render order (depth-first, respects isExpanded) */
	get visibleFlatNodes(): LTreeNode<T>[];
	get statistics(): {
		nodeCount: number;
		maxLevel: number;
		filteredNodeCount: number;
		isIndexing: boolean;
		pendingIndexCount: number;
	};

	insertArray(data: T[]): InsertArrayResult<T>;

	insertTreeNode(parentPath: string, newNode: LTreeNode<T>, noEmitChanges?: boolean): string | null;

	filterNodes(_searchText: string, _searchOptions?: SearchOptions): void;

	searchNodes(
		_searchText: string | null | undefined,
		_searchOptions?: SearchOptions
	): LTreeNode<T>[];

	createFilteredTree(targetPaths: string[]): void;

	clearFilter(): void;

	expandAll(
		nodePath?: string | string[] | null | undefined,
		options?: { exclusive?: boolean; noEmit?: boolean }
	): void;
	collapseAll(
		nodePath?: string | string[] | null | undefined,
		options?: { noEmit?: boolean }
	): void;

	insert(path: string, data: T, noEmitChanges?: boolean): void;

	getNodeByPath(path: string, _root?: LTreeNode<T> | null | undefined): LTreeNode<T> | null;

	expandNodes(
		path: string | string[],
		options?: { exclusive?: boolean; noEmit?: boolean }
	): Ltree<T>;

	collapseNodes(path: string | string[], options?: { noEmit?: boolean }): Ltree<T>;

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
	moveNode(
		sourcePath: string,
		targetPath: string,
		position: 'before' | 'after' | 'child'
	): { success: boolean; error?: string };
	removeNode(
		path: string,
		includeDescendants?: boolean
	): { success: boolean; node?: LTreeNode<T>; error?: string };
	addNode(
		parentPath: string,
		data: T,
		pathSegment?: string
	): { success: boolean; node?: LTreeNode<T>; error?: string };
	updateNode(
		path: string,
		dataUpdates: Partial<T>
	): { success: boolean; node?: LTreeNode<T>; error?: string };
	applyChanges(changes: TreeChange<T>[]): ApplyChangesResult;

	// Bulk subtree operations (single emission)
	insertBranch(parentPath: string, data: T[]): InsertBranchResult<T>;
	replaceBranch(parentPath: string, data: T[]): InsertBranchResult<T>;
	deleteBranch(path: string, keepParent?: boolean): DeleteBranchResult<T>;

	// Cross-tree copy method
	copyNodeWithDescendants(
		sourceNode: LTreeNode<T>,
		targetParentPath: string,
		transformData: (data: T, node: LTreeNode<T>) => T | null,
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
