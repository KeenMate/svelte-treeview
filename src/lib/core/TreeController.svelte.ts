import type { Index, SearchOptions } from 'flexsearch';
import { type LTreeNode, VisualState } from '../ltree/ltree-node.svelte.js';
import { createLTree } from '../ltree/ltree.svelte.js';
import {
	type Ltree,
	type InsertArrayResult,
	type InsertBranchResult,
	type DeleteBranchResult,
	type ContextMenuEntry,
	type DropPosition,
	type DragDropMode,
	type DropOperation,
	type TreeChange,
	type ApplyChangesResult,
	type ToggleIconMode,
	type ClickBehavior,
	type CheckboxMode,
	type SelectionMode,
	type HighlightMode,
	type TreeMutationOptions
} from '../ltree/types.js';
import { tick } from 'svelte';
import {
	createRenderCoordinator,
	type RenderCoordinator,
	type RenderStats
} from '../components/RenderCoordinator.svelte.js';
import { uiLogger, dragLogger } from '../logger.js';
import { perfStart, perfEnd } from '../perf-logger.js';
import {
	type ClipboardEntry,
	type TreeClipboard,
	setClipboard,
	getClipboard,
	clearClipboard,
	hasClipboard,
	getClipboardOperation as getClipboardOp,
	registerClipboardTree,
	unregisterClipboardTree,
	getClipboardTree,
	setDragSet,
	getDragSet,
	clearDragSet
} from './clipboard.js';
import type { TreeNavigation } from './navigation.js';

// Re-register global API (safe to import multiple times)
import '../global-api.js';

// ─── Paste result type ────────────────────────────────────────────────────

export interface PasteResult<T> {
	success: boolean;
	count: number;
	/** Entries skipped by the per-node transform (returned null) or the self-paste guard. */
	skipped: number;
	error?: string;
	/** Included when shouldAutoHandlePaste=false — clipboard data for consumer to handle */
	entries?: ClipboardEntry<T>[];
	operation?: 'copy' | 'cut';
	targetPath?: string;
	position?: 'child' | 'before' | 'after';
}

/**
 * A pointer to one node plus the relational context the tree already knows about it:
 * its live `parent` node and `siblings` (the children of that parent, which includes the
 * node itself). Shared shape across the clipboard callbacks (as `NodeTransformContext`'s
 * `source`/`target`) and the on* event contexts, so a consumer never has to re-resolve a
 * parent via `getNodeByPath(node.parentPath)`.
 *
 * `path` is always present. `node`/`parent`/`siblings` are live when the node is reachable
 * in this tree and null/[] when it isn't (cross-tree source, or a node removed by a cut).
 */
export interface NodeRef<T> {
	path: string;
	node: LTreeNode<T> | null;
	parent: LTreeNode<T> | null;
	/** Children of `parent` (includes `node` itself); top-level nodes when `parent` is null. */
	siblings: LTreeNode<T>[];
}

/**
 * Context passed to copyNodeTransformationCallback for each node as it is snapshotted
 * onto the clipboard. Use it to strip transient/sensitive fields before the data lands
 * on the (cross-tree) shared clipboard.
 */
/**
 * Context passed to BOTH copyNodeTransformationCallback and pasteNodeTransformationCallback,
 * one per node. `phase` says which callback is running; `target` is null during the copy
 * phase (no destination has been chosen yet) and populated during paste. `source` is the
 * origin side — always carries the path; node/parent/siblings are live when reachable
 * (same-tree) and null/[] cross-tree or once a cut source has been removed.
 *
 * Symmetric by design: the same field means the same thing in both phases, so a naming/id
 * derivation reads identically whether you clean data on copy or on paste. Return new data
 * to derive ids/values/names; from pasteNodeTransformationCallback return null to skip a
 * node (skipping a root skips its whole subtree). Pure — reads the pristine snapshot, never
 * mutates it, so repeat pastes stay clean.
 */
export interface NodeTransformContext<T> {
	operation: 'copy' | 'cut';
	/** Which callback is running: 'copy' at snapshot time, 'paste' at insert time. */
	phase: 'copy' | 'paste';
	/** True for a top-level node, false for a descendant riding along inside it. */
	isRoot: boolean;
	/** Index of the root entry within this batch (descendants share their root's index). */
	index: number;
	/** How the pasted roots land relative to `target.node` — null during the copy phase
	 * (no destination chosen yet). Mirrors the DropPosition vocabulary of onNodeDrop. */
	position: 'child' | 'before' | 'after' | null;
	/** The origin side. `path` is always present; node/parent/siblings are live when the
	 * source is reachable (same-tree) and null/[] cross-tree or after a cut removed it. */
	source: NodeRef<T>;
	/** The destination side, symmetric with `source` — null during the copy phase. `node`
	 * is the node you targeted (null when pasting at the tree root); `parent` is its parent;
	 * `siblings` are its neighbours (children of `parent`), LIVE and batch-aware (include
	 * nodes added earlier in THIS paste). The roots' actual landing neighbours depend on
	 * `position`: for 'before'/'after' they ARE `target.siblings`; for 'child' they are
	 * `target.node`'s children (top-level nodes = `target.siblings` when `node` is null).
	 *   const landing = position === 'child' && target.node
	 *     ? Object.values(target.node.children)
	 *     : (target?.siblings ?? []);
	 *   name = uniqueName(data.name, landing.map(s => s.data?.name)); */
	target: NodeRef<T> | null;
}

/**
 * Context for onNodeClick / onNodeDoubleClick. It IS a NodeRef: the clicked node plus its
 * live parent/siblings, so a click handler never has to reach back through the controller
 * for what the tree already resolved.
 */
export type NodeEventContext<T> = NodeRef<T>;

/**
 * Context for onNodeDragStart / onNodeDragOver. A NodeRef (for dragStart the node that
 * started the drag; for dragOver the node currently hovered) plus the raw DragEvent and
 * `dragged` — the FULL top-level set in flight. A drag is single-origin at the DOM level,
 * so the event fires once; `dragged` is the whole multi-selection (or just the one node for
 * a single drag) so a handler doesn't have to read `controller.highlightedPaths` itself.
 */
export interface NodeDragContext<T> extends NodeRef<T> {
	event: DragEvent;
	/** The full top-level set being dragged (multi-selection; a single-item array otherwise). */
	dragged: NodeRef<T>[];
}

/**
 * Context for onNodeDrop, symmetric with NodeTransformContext: `source` is the dragged node
 * (with its parent/siblings), `target` is the drop node (null when dropped into empty space
 * or the tree root), `position`/`operation` describe how it landed, `event` is the original
 * DOM event.
 *
 * `dragged` is the full top-level dragged set (`source` is its lead node); a drop fires once
 * even for a multi-drag, so this is how you see the whole set. `dropped` is the resulting
 * placed nodes AFTER an auto-handled op (move: the moved nodes at their new home; copy: the
 * fresh copies) — it is null when the library did NOT place them (a cross-tree drop, or
 * shouldAutoHandleMove/Copy=false), because then the consumer owns insertion.
 */
export interface NodeDropContext<T> {
	source: NodeRef<T>;
	target: NodeRef<T> | null;
	/** The full top-level dragged set (includes `source`). */
	dragged: NodeRef<T>[];
	/** The placed nodes after an auto-handled move/copy; null when the library didn't place them. */
	dropped: NodeRef<T>[] | null;
	position: DropPosition;
	operation: DropOperation;
	event: DragEvent | TouchEvent;
}

/**
 * Context for the set-oriented clipboard/delete events (onCopy / onCut / onDelete), mirroring
 * the BeforeCopyContext/BeforeDeleteContext shape of their before* twins. `nodes` are the
 * resolved live nodes for `paths`; for onCut/onDelete they are pre-removal snapshots captured
 * before the nodes left the tree (the tree no longer holds them by the time the event fires).
 */
export interface ClipboardEventContext<T> {
	/** Present for copy/cut; omitted for delete (which has no copy/cut operation). */
	operation?: 'copy' | 'cut';
	paths: string[];
	nodes: LTreeNode<T>[];
}

/**
 * Context for the selection-change events (onHighlightChange = UI multi-select set;
 * onSelectionChange = checkbox set). `paths` is the new set, `nodes` its resolved live nodes.
 */
export interface SelectionChangeContext<T> {
	paths: Set<string>;
	nodes: LTreeNode<T>[];
}

/**
 * Context for beforeCopyCallback / beforeCutCallback — batch policy, runs before the
 * snapshot is taken. Return a new path list to rewrite the set, false to block, or nothing
 * to proceed.
 */
export interface BeforeCopyContext<T> {
	operation: 'copy' | 'cut';
	/** The paths about to be copied/cut (the highlight set, or the explicit paths arg). */
	paths: string[];
	/** The resolved live nodes for those paths (missing paths are dropped). */
	nodes: LTreeNode<T>[];
}

/**
 * Context for beforeDeleteCallback — batch policy before the built-in Delete removes nodes.
 * Return a narrowed path list to delete only those, false to block entirely, or nothing to
 * proceed. Mirrors BeforeCopyContext's paths/nodes shape (delete has no copy/cut operation).
 */
export interface BeforeDeleteContext<T> {
	/** The top-level paths about to be deleted. */
	paths: string[];
	/** The resolved live nodes for those paths. */
	nodes: LTreeNode<T>[];
}

/**
 * Context for beforePasteCallback — batch policy run once before the insert loop.
 * Return { targetPath?, position? } to redirect, false to block, or nothing to proceed.
 */
export interface BeforePasteContext<T> {
	operation: 'copy' | 'cut';
	/** The destination side (proposed, pre-insert): `path` ('' = root, after the leaf-aware
	 * position redirect) and the node at that path (null at root). The hook may still
	 * redirect via its return value. */
	target: {
		path: string;
		node: LTreeNode<T> | null;
	};
	/** Immutable clipboard snapshots ({ sourceTreeId, sourcePath, data, descendants }) —
	 * NOT live tree nodes (sources may be cross-tree, or removed on a cut). */
	entries: readonly ClipboardEntry<T>[];
}

// ─── Shared interfaces (also used by Node.svelte) ────────────────────────

export interface SelectionModifiers {
	ctrl: boolean;
	shift: boolean;
}

export interface NodeCallbacks<T> {
	onNodeClicked: (node: LTreeNode<T>, modifiers?: SelectionModifiers) => void;
	onCheckboxToggle: (node: LTreeNode<T>, options?: { skipFocus?: boolean }) => void;
	onNodeRightClicked: (node: LTreeNode<T>, event: MouseEvent) => void;
	onNodeDragStart: (node: LTreeNode<T>, event: DragEvent) => void;
	onNodeDragOver: (node: LTreeNode<T>, event: DragEvent) => void;
	onNodeDragLeave: (node: LTreeNode<T>, event: DragEvent) => void;
	onNodeDrop: (node: LTreeNode<T>, event: DragEvent) => void;
	onZoneDrop: (node: LTreeNode<T>, position: DropPosition, event: DragEvent) => void;
	onTouchDragStart: (node: LTreeNode<T>, event: TouchEvent) => void;
	onTouchDragMove: (node: LTreeNode<T>, event: TouchEvent) => void;
	onTouchDragEnd: (node: LTreeNode<T>, event: TouchEvent) => void;
}

export interface NodeConfig {
	clickBehavior: ClickBehavior;
	shouldShowCheckboxes: boolean;
	checkboxMode: CheckboxMode;
	shouldClickToggleCheckbox: boolean;
	expandIconClass: string;
	collapseIconClass: string;
	leafIconClass: string;
	toggleIconMode: ToggleIconMode;
	highlightedNodeClass: string | null | undefined;
	focusedNodeClass: string | null | undefined;
	dragOverNodeClass: string | null | undefined;
	// Data-driven per-row class hooks. Applied to .stv__node (nodeClass) and
	// .stv__node-content (nodeContentClass). Typed LTreeNode<any> here because
	// NodeConfig is non-generic plumbing; the public Tree props are LTreeNode<T>.
	nodeClass: ((node: LTreeNode<any>) => string | null | undefined) | undefined;
	nodeContentClass: ((node: LTreeNode<any>) => string | null | undefined) | undefined;
	dropZoneMode: 'floating' | 'glow';
	dropZoneLayout: 'around' | 'above' | 'below' | 'wave' | 'wave2';
	dropZoneStart: number | string;
	dropZoneMaxWidth: number;
	isCopyAllowed: boolean;
	isAccordionExpand: boolean;
}

// ─── Controller props ─────────────────────────────────────────────────────

export interface TreeControllerProps<T> {
	// MAPPINGS
	idMember: string;
	pathMember: string;
	parentPathMember?: string | null | undefined;
	levelMember?: string | null | undefined;
	isExpandedMember?: string | null | undefined;
	getIsExpandedCallback?: (node: LTreeNode<T>) => boolean;
	isSelectableMember?: string | null | undefined;
	getIsSelectableCallback?: (node: LTreeNode<T>) => boolean;
	isSelectedMember?: string | null | undefined;
	getIsSelectedCallback?: (node: LTreeNode<T>) => boolean;
	isDraggableMember?: string | null | undefined;
	getIsDraggableCallback?: (node: LTreeNode<T>) => boolean;
	isDropAllowedMember?: string | null | undefined;
	getIsDropAllowedCallback?: (node: LTreeNode<T>) => boolean;
	allowedDropPositionsMember?: string | null | undefined;
	getAllowedDropPositionsCallback?: (node: LTreeNode<T>) => DropPosition[] | null | undefined;
	isCollapsibleMember?: string | null | undefined;
	getIsCollapsibleCallback?: (node: LTreeNode<T>) => boolean;
	hasChildrenMember?: string | null | undefined;
	isSorted?: boolean | null | undefined;

	displayValueMember?: string | null | undefined;
	getDisplayValueCallback?: (node: LTreeNode<T>) => string;

	searchValueMember?: string | null | undefined;
	getSearchValueCallback?: (node: LTreeNode<T>) => string;

	orderMember?: string | null | undefined;

	treeId?: string | null | undefined;
	treePathSeparator?: string | null | undefined;
	sortCallback?: (items: LTreeNode<T>[]) => LTreeNode<T>[];

	// DATA
	data: T[];
	focusedNode?: LTreeNode<T> | null | undefined;
	highlightedPaths?: Set<string>;
	selectedPaths?: Set<string>;

	// BEHAVIOUR
	expandLevel?: number | null | undefined;
	clickBehavior?: ClickBehavior | null | undefined;
	/**
	 * `'single'` (default): Ctrl/Shift+click act as plain click, Shift+Arrow is no-op,
	 * Enter is no-op. `'multi'`: Ctrl-toggle, Shift-range, Shift+Arrow extends, Enter
	 * toggles highlight on the focused node.
	 */
	selectionMode?: SelectionMode | null | undefined;
	shouldShowCheckboxes?: boolean | null | undefined;
	checkboxMode?: CheckboxMode | null | undefined;
	/**
	 * When true AND `shouldShowCheckboxes` is on, a plain click on a selectable node's label
	 * toggles the checkbox instead of running the normal click flow — `focusedNode` and
	 * `highlightedPaths` are NOT updated. Expand-on-click still happens if `clickBehavior`
	 * is `'expand'` or `'expand-and-focus'`. Modified clicks (Ctrl/Shift) fall through to
	 * the normal multi-highlight path.
	 */
	shouldClickToggleCheckbox?: boolean | null | undefined;
	/**
	 * Interceptor called before a checkbox toggle is applied.
	 * @param node - The node whose checkbox was clicked
	 * @param checked - The intended new state (true = checking, false = unchecking)
	 * @param affectedPaths - Paths that would be affected (includes descendants in cascade mode)
	 * @returns false to cancel, string[] to override affected paths, or void/true to proceed
	 */
	beforeCheckboxToggleCallback?: (node: LTreeNode<T>, checked: boolean, affectedPaths: string[]) => boolean | string[] | void;
	/**
	 * How shift+click range selection works:
	 * - 'visual': selects all visible (expanded) nodes between the two clicks in display order (default)
	 * - 'logical': selects all nodes between the two clicks in tree order, including collapsed/hidden nodes
	 */
	rangeSelectionMode?: 'visual' | 'logical';
	initializeIndexCallback?: () => Index;
	searchText?: string | null | undefined;
	shouldUseInternalSearchIndex?: boolean | null | undefined;
	indexerBatchSize?: number | null | undefined;
	indexerTimeout?: number | null | undefined;
	shouldDisplayDebugInformation?: boolean;
	shouldDisplayContextMenuInDebugMode?: boolean;
	isLoading?: boolean;

	// Progressive rendering
	isProgressiveRender?: boolean;
	initialBatchSize?: number;
	maxBatchSize?: number;
	onRenderStart?: () => void;
	onRenderProgress?: (stats: RenderStats) => void;
	onRenderComplete?: (stats: RenderStats) => void;

	// Flat rendering
	isFlatRenderingEnabled?: boolean;

	// Virtual scrolling (flat mode only)
	/** Enable virtual scrolling in flat mode. Only visible nodes + overscan are rendered. */
	isVirtualScrollEnabled?: boolean;
	/** Explicit row height in px. Auto-measured from first row if not set. */
	virtualRowHeight?: number;
	/** Extra rows above/below viewport (default: 5) */
	virtualOverscan?: number;
	/** CSS height for scroll container. Auto-detected from parent if not set, fallback 400px. */
	virtualContainerHeight?: string;

	// DRAG AND DROP
	dragDropMode?: DragDropMode;
	dropZoneMode?: 'floating' | 'glow';
	dropZoneLayout?: 'around' | 'above' | 'below' | 'wave' | 'wave2';
	dropZoneStart?: number | string;
	dropZoneMaxWidth?: number;
	isCopyAllowed?: boolean;
	shouldAutoHandleCopy?: boolean;
	shouldAutoHandleMove?: boolean;
	shouldAutoHandlePaste?: boolean;
	isAccordionExpand?: boolean;

	// EVENTS (on* = fire-and-forget notifications). Each carries a context object mirroring
	// the clipboard callbacks: single-node events get a NodeRef (node + live parent/siblings);
	// onNodeDrop gets symmetric source/target NodeRefs; the set events carry paths + nodes.
	onNodeClick?: (ctx: NodeEventContext<T>) => void;
	onNodeDoubleClick?: (ctx: NodeEventContext<T>) => void;
	onNodeDragStart?: (ctx: NodeDragContext<T>) => void;
	onNodeDragOver?: (ctx: NodeDragContext<T>) => void;
	onNodeDrop?: (ctx: NodeDropContext<T>) => void;
	onHighlightChange?: (ctx: SelectionChangeContext<T>) => void;
	onSelectionChange?: (ctx: SelectionChangeContext<T>) => void;
	// Post-operation clipboard notifications (fired AFTER the op succeeds). Symmetric
	// with the before*Callback interceptors: onCopy/onCut/onDelete carry the final paths
	// plus resolved nodes (pre-removal snapshots for cut/delete); onPaste the PasteResult.
	onCopy?: (ctx: ClipboardEventContext<T>) => void;
	onCut?: (ctx: ClipboardEventContext<T>) => void;
	onPaste?: (result: PasteResult<T>) => void;
	/** Fired after `deleteNodes` removes nodes (built-in Delete key or the public method),
	 *  with the top-level paths that were actually removed plus their pre-removal nodes. */
	onDelete?: (ctx: ClipboardEventContext<T>) => void;

	/**
	 * Opt into built-in keyboard shortcuts (default false): Ctrl/Cmd+C/X/V (copy/cut/paste),
	 * Delete (remove selection), Escape (cancel a pending cut), plus the classic CUA aliases
	 * Ctrl+Insert (copy) / Shift+Insert (paste) / Shift+Delete (cut). Off by default so it
	 * never hijacks keys; a consumer `onTreeKeydown` still runs first and can override or
	 * suppress any of these. Paste targets the focused node (root when none) and uses
	 * `pasteNodeTransformationCallback` for id/name derivation.
	 */
	shouldHandleKeyboardShortcuts?: boolean;

	// INTERCEPTORS (before*Callback = can modify/block)
	/** Runs before the built-in Delete removes anything. Return a narrowed path[] to
	 *  restrict what's removed, or `false` to block entirely. `nodes` are the resolved
	 *  top-level nodes about to be removed (descendants ride along). */
	beforeDeleteCallback?: (ctx: BeforeDeleteContext<T>) => string[] | false | void;
	beforeDropCallback?: (
		dropNode: LTreeNode<T> | null,
		draggedNode: LTreeNode<T>,
		position: DropPosition,
		event: DragEvent | TouchEvent,
		operation: DropOperation
	) =>
		| boolean
		| { position?: DropPosition; operation?: DropOperation }
		| void
		| Promise<
				| boolean
				| { position?: DropPosition; operation?: DropOperation }
				| void
		  >;
	beforeCopyCallback?: (ctx: BeforeCopyContext<T>) => string[] | false | void;
	beforeCutCallback?: (ctx: BeforeCopyContext<T>) => string[] | false | void;
	beforePasteCallback?: (
		ctx: BeforePasteContext<T>
	) => { targetPath?: string; position?: 'child' | 'before' | 'after' } | false | void;
	/** Per-node transform applied as data is snapshotted onto the clipboard (copy/cut).
	 *  Use to strip transient/sensitive fields before they hit the shared clipboard. */
	copyNodeTransformationCallback?: (data: T, ctx: NodeTransformContext<T>) => T;
	/** Per-node transform applied as data is inserted on paste. Return new data (fresh
	 *  ids/values/names) or null to skip the node (skipping a root skips its subtree).
	 *  Pure: reads the pristine clipboard snapshot, never mutates it. */
	pasteNodeTransformationCallback?: (data: T, ctx: NodeTransformContext<T>) => T | null;

	// DATA PROVIDERS (get*Callback = returns data the system uses)
	getContextMenuItemsCallback?: (
		node: LTreeNode<T>,
		closeMenuCallback: () => void,
		selectedNodes?: LTreeNode<T>[]
	) => ContextMenuEntry[];

	// Tells the controller whether a context menu snippet exists (set by Tree.svelte)
	hasContextMenuSnippet?: boolean;

	// VISUALS
	bodyClass?: string | null | undefined;
	highlightedNodeClass?: string | null | undefined;
	focusedNodeClass?: string | null | undefined;
	nodeClass?: (node: LTreeNode<T>) => string | null | undefined;
	nodeContentClass?: (node: LTreeNode<T>) => string | null | undefined;
	dragOverNodeClass?: string | null | undefined;
	expandIconClass?: string | null | undefined;
	collapseIconClass?: string | null | undefined;
	leafIconClass?: string | null | undefined;
	toggleIconMode?: ToggleIconMode;
	scrollHighlightTimeout?: number | null | undefined;
	scrollHighlightClass?: string | null | undefined;
	contextMenuXOffset?: number | null | undefined;
	contextMenuYOffset?: number | null | undefined;
}

// ─── TreeController ───────────────────────────────────────────────────────

export class TreeController<T> {
	// ── LTree instance ──────────────────────────────────────────────────
	tree!: Ltree<T>;

	// ── Render coordinator ──────────────────────────────────────────────
	renderCoordinator!: RenderCoordinator | null;

	// ── Stable callback & config objects for Node context ───────────────
	nodeCallbacks!: NodeCallbacks<T>;
	nodeConfig = $state<NodeConfig>({
		clickBehavior: 'expand-and-focus',
		shouldShowCheckboxes: false,
		checkboxMode: 'independent',
		shouldClickToggleCheckbox: false,
		expandIconClass: 'stv__toggle-icon--expand',
		collapseIconClass: 'stv__toggle-icon--collapse',
		leafIconClass: 'stv__toggle-icon--leaf',
		highlightedNodeClass: undefined,
		focusedNodeClass: undefined,
		nodeClass: undefined,
		nodeContentClass: undefined,
		dragOverNodeClass: undefined,
		dropZoneMode: 'glow',
		dropZoneLayout: 'around',
		dropZoneStart: 33,
		toggleIconMode: 'rotate',
		dropZoneMaxWidth: 120,
		isCopyAllowed: false,
		isAccordionExpand: false
	});

	// ── Props stored as reactive state ──────────────────────────────────
	treeId = $state<string>('');
	treePathSeparator = $state<string>('.');

	// DATA (bidirectional / output)
	data = $state.raw<T[]>([]);
	focusedNode = $state.raw<LTreeNode<T> | null | undefined>(null);
	highlightedPaths = $state.raw<Set<string>>(new Set());
	/** Hidden internal cursor used by Shift+Arrow / Shift+click to extend ranges
	 *  from the focused node. Set on first Shift action, advances on subsequent
	 *  Shift actions, cleared on any plain navigation. Not exposed via props. */
	private _shiftCursor: string | null = null;
	/** Manual double-click detection state. We can't rely on the browser's native
	 *  dblclick event because the first click triggers focus → _setFocusedNode bumps
	 *  node._rev → flat-mode {#each} destroys and recreates the row, so the second
	 *  click lands on a different DOM element and the browser refuses to synthesize a
	 *  dblclick. Tracking the click on the controller (which survives the re-render)
	 *  sidesteps that. Drives both the public onNodeDoubleClick event (all
	 *  clickBehaviors) and the built-in expand/collapse-on-double for 'select' mode. */
	private _lastClickPath: string | null = null;
	private _lastClickTime: number = 0;
	selectedPaths = $state.raw<Set<string>>(new Set());
	insertResult = $state.raw<InsertArrayResult<T> | null | undefined>(null);
	searchText = $state<string | null | undefined>(undefined);
	isRendering = $state(false);

	// BEHAVIOUR
	shouldDisplayDebugInformation = $state(false);
	shouldDisplayContextMenuInDebugMode = $state(false);
	rangeSelectionMode = $state<'visual' | 'logical'>('visual');
	isLoading = $state(false);
	isFlatRenderingEnabled = $state(true);
	isProgressiveRender = $state(true);
	initialBatchSize = $state(20);
	maxBatchSize = $state(500);
	bodyClass = $state<string | null | undefined>(undefined);

	// DRAG AND DROP
	dragDropMode = $state<DragDropMode>('none');
	isCopyAllowed = $state(false);
	isAccordionExpand = $state(false);
	shouldAutoHandleCopy = $state(true);
	shouldAutoHandleMove = $state(true);
	shouldAutoHandlePaste = $state(true);
	shouldHandleKeyboardShortcuts = $state(false);

	// Event handlers (on* = fire-and-forget)
	onNodeClickHandler: TreeControllerProps<T>['onNodeClick'];
	onNodeDoubleClickHandler: TreeControllerProps<T>['onNodeDoubleClick'];
	onHighlightChangeHandler: TreeControllerProps<T>['onHighlightChange'];
	onSelectionChangeHandler: TreeControllerProps<T>['onSelectionChange'];
	onNodeDragStartHandler: TreeControllerProps<T>['onNodeDragStart'];
	onNodeDragOverHandler: TreeControllerProps<T>['onNodeDragOver'];
	onNodeDropHandler: TreeControllerProps<T>['onNodeDrop'];
	onCopyHandler: TreeControllerProps<T>['onCopy'];
	onCutHandler: TreeControllerProps<T>['onCut'];
	onPasteHandler: ((result: PasteResult<T>) => void) | undefined;
	onDeleteHandler: TreeControllerProps<T>['onDelete'];
	onRenderStartHandler: (() => void) | undefined;
	onRenderProgressHandler: ((stats: RenderStats) => void) | undefined;
	onRenderCompleteHandler: ((stats: RenderStats) => void) | undefined;

	// Interceptor handlers (before*Callback)
	beforeDropHandler: TreeControllerProps<T>['beforeDropCallback'];
	beforeCopyHandler: TreeControllerProps<T>['beforeCopyCallback'];
	beforeCutHandler: TreeControllerProps<T>['beforeCutCallback'];
	beforePasteHandler: TreeControllerProps<T>['beforePasteCallback'];
	beforeDeleteHandler: TreeControllerProps<T>['beforeDeleteCallback'];
	copyTransformHandler: TreeControllerProps<T>['copyNodeTransformationCallback'];
	pasteTransformHandler: TreeControllerProps<T>['pasteNodeTransformationCallback'];
	beforeCheckboxToggleHandler: TreeControllerProps<T>['beforeCheckboxToggleCallback'];

	// Data provider handlers (get*Callback)
	getContextMenuItemsHandler: TreeControllerProps<T>['getContextMenuItemsCallback'];

	// Visual config (for nodeConfig updates)
	clickBehavior = $state<ClickBehavior>('expand-and-focus');
	selectionMode = $state<SelectionMode>('single');
	shouldShowCheckboxes = $state(false);
	checkboxMode = $state<CheckboxMode>('independent');
	shouldClickToggleCheckbox = $state(false);
	expandIconClass = $state('stv__toggle-icon--expand');
	collapseIconClass = $state('stv__toggle-icon--collapse');
	leafIconClass = $state('stv__toggle-icon--leaf');
	toggleIconMode = $state<ToggleIconMode>('rotate');
	highlightedNodeClass = $state<string | null | undefined>(undefined);
	focusedNodeClass = $state<string | null | undefined>(undefined);
	nodeClass = $state<((node: LTreeNode<any>) => string | null | undefined) | undefined>(undefined);
	nodeContentClass = $state<((node: LTreeNode<any>) => string | null | undefined) | undefined>(undefined);
	dragOverNodeClass = $state<string | null | undefined>(undefined);
	dropZoneMode = $state<'floating' | 'glow'>('glow');
	dropZoneLayout = $state<'around' | 'above' | 'below' | 'wave' | 'wave2'>('around');
	dropZoneStart = $state<number | string>(33);
	dropZoneMaxWidth = $state(120);
	scrollHighlightTimeout = $state(4000);
	scrollHighlightClass = $state<string | null | undefined>('stv__node-content--scroll-highlight');
	contextMenuXOffset = $state(8);
	contextMenuYOffset = $state(0);

	hasContextMenuSnippet = $state(false);

	// Virtual scrolling
	isVirtualScrollEnabled = $state(false);
	virtualRowHeight = $state<number | undefined>(undefined);
	virtualOverscan = $state(5);
	virtualContainerHeight = $state<string | undefined>(undefined);

	// ── Navigation strategy ────────────────────────────────────────────
	navigation!: TreeNavigation<T>;

	// ── Internal mutable state ──────────────────────────────────────────

	// Context menu
	contextMenuVisible = $state(false);
	contextMenuX = $state(0);
	contextMenuY = $state(0);
	contextMenuNode: LTreeNode<T> | null = $state.raw(null);
	isDebugMenuActive = $state(false);

	// Scroll highlight
	currentHighlight: {
		element: HTMLElement;
		timeoutId: ReturnType<typeof setTimeout>;
	} | null = null;

	// Drag and drop
	draggedNode: LTreeNode<any> | null = $state.raw(null);
	isDragInProgress = $state(false);
	// Snapshot of highlightedPaths taken when the OS-convention selection sync
	// in _onNodeDragStart replaces the highlight with the dragged node. Restored
	// on dragend if the drag was cancelled (dropEffect === 'none'); cleared
	// otherwise. Null when no replacement happened (e.g. dragging a node that
	// was already in the highlight set).
	private _preDragHighlightSnapshot: Set<string> | null = null;
	hoveredNodeForDrop = $state.raw<LTreeNode<any> | null>(null);
	activeDropPosition = $state<DropPosition | null>(null);
	currentDropOperation = $state<DropOperation>('move');

	// Floating drop zones (rendered at Tree level with position:fixed)
	floatingZoneRect = $state<{ top: number; left: number; width: number; height: number } | null>(null);
	floatingHoveredZone = $state<'before' | 'after' | 'child' | null>(null);

	// Touch drag
	touchDragState = $state.raw<{
		node: LTreeNode<any> | null;
		startX: number;
		startY: number;
		isDragging: boolean;
		ghostElement: HTMLElement | null;
		currentDropTarget: LTreeNode<any> | null;
	}>({
		node: null,
		startX: 0,
		startY: 0,
		isDragging: false,
		ghostElement: null,
		currentDropTarget: null
	});
	touchTimer: ReturnType<typeof setTimeout> | null = null;

	// Progressive flat rendering
	flatRenderedIds = $state.raw<Set<string>>(new Set());
	flatRenderQueue = $state.raw<string[]>([]);
	flatRenderAnimationFrame: number | null = null;
	currentBatchSize: number = 0;

	// Virtual scrolling state
	vsScrollTop = $state(0);
	vsMeasuredRowHeight = $state<number | null>(null);
	vsContainerRef = $state<HTMLDivElement | undefined>();
	vsDetectedHeight = $state<string | null>(null);
	private vsRafPending = false;

	// Drop placeholder
	isDropPlaceholderActive = $state(false);

	// Clipboard — paths dimmed during cut operation
	cutPaths = $state.raw<Set<string>>(new Set());

	// Skip insertArray flag
	_skipInsertArray = false;

	// Progressive flat rendering tracker
	private lastFlatNodesTracker: Symbol | undefined | null = null;

	// Container element (set by the host component for scrollToPath / debug menu)
	containerElement: HTMLElement | null = null;

	// ── Derived ─────────────────────────────────────────────────────────

	// Virtual scroll derived computations
	vsRowHeight = $derived(this.virtualRowHeight ?? this.vsMeasuredRowHeight ?? 32);
	vsActive = $derived(this.isVirtualScrollEnabled && this.isFlatRenderingEnabled);
	vsContainerStyle = $derived(this.virtualContainerHeight ?? this.vsDetectedHeight ?? '400px');
	allFlatNodes = $derived(this.tree?.visibleFlatNodes ?? []);
	vsTotalCount = $derived(this.allFlatNodes.length);
	vsTotalHeight = $derived(this.vsTotalCount * this.vsRowHeight);
	vsStartIndex = $derived(
		this.vsActive
			? Math.max(0, Math.floor(this.vsScrollTop / this.vsRowHeight) - this.virtualOverscan)
			: 0
	);
	vsEndIndex = $derived(
		this.vsActive
			? Math.min(
					this.vsTotalCount,
					Math.ceil(
						(this.vsScrollTop + (this.vsContainerRef?.clientHeight ?? 0)) / this.vsRowHeight
					) + this.virtualOverscan
				)
			: this.vsTotalCount
	);
	vsOffsetY = $derived(this.vsStartIndex * this.vsRowHeight);

	flatNodesToRender = $derived(
		this.vsActive
			? this.allFlatNodes.slice(this.vsStartIndex, this.vsEndIndex)
			: this.isFlatRenderingEnabled && this.isProgressiveRender
				? (this.tree?.visibleFlatNodes?.filter((n) => this.flatRenderedIds.has(String(n.id))) ?? [])
				: (this.tree?.visibleFlatNodes ?? [])
	);

	get statistics() {
		return this.tree?.statistics;
	}

	// ── Constructor ─────────────────────────────────────────────────────

	constructor(props: TreeControllerProps<T>) {
		// Assign prop values (with defaults)
		this.treeId = props.treeId || this.generateTreeId();
		this.treePathSeparator = props.treePathSeparator ?? '.';

		// Register in the cross-tree clipboard registry so a cut pasted into ANOTHER
		// tree can remove the originals from here (same-tree cut removes them directly).
		registerClipboardTree(this.treeId, this);

		this.data = props.data;
		this.focusedNode = props.focusedNode ?? null;
		this.highlightedPaths = props.highlightedPaths ?? new Set();
		this.selectedPaths = props.selectedPaths ?? new Set();
		this.searchText = props.searchText;

		this.shouldDisplayDebugInformation = props.shouldDisplayDebugInformation ?? false;
		this.shouldDisplayContextMenuInDebugMode = props.shouldDisplayContextMenuInDebugMode ?? false;
		this.rangeSelectionMode = props.rangeSelectionMode ?? 'visual';
		this.isLoading = props.isLoading ?? false;

		this.isFlatRenderingEnabled = props.isFlatRenderingEnabled ?? true;
		this.isProgressiveRender = props.isProgressiveRender ?? true;
		this.initialBatchSize = props.initialBatchSize ?? 20;
		this.maxBatchSize = props.maxBatchSize ?? 500;
		this.bodyClass = props.bodyClass;

		this.dragDropMode = props.dragDropMode ?? 'none';
		this.isCopyAllowed = props.isCopyAllowed ?? false;
		this.shouldAutoHandleCopy = props.shouldAutoHandleCopy ?? true;
		this.shouldAutoHandleMove = props.shouldAutoHandleMove ?? true;
		this.shouldAutoHandlePaste = props.shouldAutoHandlePaste ?? true;
		this.isAccordionExpand = props.isAccordionExpand ?? false;

		this.clickBehavior = props.clickBehavior ?? 'expand-and-focus';
		this.selectionMode = props.selectionMode ?? 'single';
		this.shouldShowCheckboxes = props.shouldShowCheckboxes ?? false;
		this.checkboxMode = props.checkboxMode ?? 'independent';
		this.shouldClickToggleCheckbox = props.shouldClickToggleCheckbox ?? false;
		this.beforeCheckboxToggleHandler = props.beforeCheckboxToggleCallback;
		this.expandIconClass = props.expandIconClass ?? 'stv__toggle-icon--expand';
		this.collapseIconClass = props.collapseIconClass ?? 'stv__toggle-icon--collapse';
		this.leafIconClass = props.leafIconClass ?? 'stv__toggle-icon--leaf';
		this.toggleIconMode = props.toggleIconMode ?? 'rotate';
		this.highlightedNodeClass = props.highlightedNodeClass;
		this.focusedNodeClass = props.focusedNodeClass;
		this.nodeClass = props.nodeClass;
		this.nodeContentClass = props.nodeContentClass;
		this.dragOverNodeClass = props.dragOverNodeClass;
		this.dropZoneMode = props.dropZoneMode ?? 'glow';
		this.dropZoneLayout = props.dropZoneLayout ?? 'around';
		this.dropZoneStart = props.dropZoneStart ?? 33;
		this.dropZoneMaxWidth = props.dropZoneMaxWidth ?? 120;
		this.scrollHighlightTimeout = props.scrollHighlightTimeout ?? 4000;
		this.scrollHighlightClass = props.scrollHighlightClass ?? 'stv__node-content--scroll-highlight';
		this.contextMenuXOffset = props.contextMenuXOffset ?? 8;
		this.contextMenuYOffset = props.contextMenuYOffset ?? 0;
		this.hasContextMenuSnippet = props.hasContextMenuSnippet ?? false;

		// Virtual scrolling
		this.isVirtualScrollEnabled = props.isVirtualScrollEnabled ?? false;
		this.virtualRowHeight = props.virtualRowHeight;
		this.virtualOverscan = props.virtualOverscan ?? 5;
		this.virtualContainerHeight = props.virtualContainerHeight;

		// Store callbacks
		this.onNodeClickHandler = props.onNodeClick;
		this.onNodeDoubleClickHandler = props.onNodeDoubleClick;
		this.onHighlightChangeHandler = props.onHighlightChange;
		this.onSelectionChangeHandler = props.onSelectionChange;
		this.onNodeDragStartHandler = props.onNodeDragStart;
		this.onNodeDragOverHandler = props.onNodeDragOver;
		this.onNodeDropHandler = props.onNodeDrop;
		this.onCopyHandler = props.onCopy;
		this.onCutHandler = props.onCut;
		this.onPasteHandler = props.onPaste;
		this.onDeleteHandler = props.onDelete;
		this.beforeDropHandler = props.beforeDropCallback;
		this.beforeCopyHandler = props.beforeCopyCallback;
		this.beforeCutHandler = props.beforeCutCallback;
		this.beforePasteHandler = props.beforePasteCallback;
		this.beforeDeleteHandler = props.beforeDeleteCallback;
		this.shouldHandleKeyboardShortcuts = props.shouldHandleKeyboardShortcuts ?? false;
		this.copyTransformHandler = props.copyNodeTransformationCallback;
		this.pasteTransformHandler = props.pasteNodeTransformationCallback;
		this.getContextMenuItemsHandler = props.getContextMenuItemsCallback;
		this.onRenderStartHandler = props.onRenderStart;
		this.onRenderProgressHandler = props.onRenderProgress;
		this.onRenderCompleteHandler = props.onRenderComplete;

		// ── Create LTree ────────────────────────────────────────────────
		// svelte-ignore non_reactive_update
		this.tree = createLTree<T>(
			props.idMember,
			props.pathMember,
			props.parentPathMember,
			props.levelMember,
			props.hasChildrenMember,
			props.isExpandedMember,
			props.getIsExpandedCallback,
			props.isSelectableMember,
			props.getIsSelectableCallback,
			props.isSelectedMember,
			props.getIsSelectedCallback,
			props.isDraggableMember,
			props.getIsDraggableCallback,
			props.isDropAllowedMember,
			props.getIsDropAllowedCallback,
			props.allowedDropPositionsMember,
			props.displayValueMember,
			props.getDisplayValueCallback,
			props.searchValueMember,
			props.getSearchValueCallback,
			props.getAllowedDropPositionsCallback,
			props.isCollapsibleMember,
			props.getIsCollapsibleCallback,
			props.orderMember,
			this.treeId,
			this.treePathSeparator,
			props.expandLevel,
			props.shouldUseInternalSearchIndex,
			props.initializeIndexCallback,
			props.indexerBatchSize,
			props.indexerTimeout,
			{
				shouldDisplayDebugInformation: props.shouldDisplayDebugInformation,
				isSorted: props.isSorted,
				sortCallback: props.sortCallback
			}
		);

		// ── Create render coordinator ───────────────────────────────────
		this.renderCoordinator = this.isProgressiveRender
			? createRenderCoordinator(2, {
					onStart: () => {
						this.isRendering = true;
						this.onRenderStartHandler?.();
					},
					onProgress: (stats) => {
						this.onRenderProgressHandler?.(stats);
					},
					onComplete: (stats) => {
						this.isRendering = false;
						this.onRenderCompleteHandler?.(stats);
					}
				})
			: null;

		// ── Create stable nodeCallbacks ─────────────────────────────────
		this.nodeCallbacks = {
			onNodeClicked: (node: LTreeNode<T>, modifiers?: SelectionModifiers) => this._onNodeClicked(node, modifiers, { uiClick: true }),
			onCheckboxToggle: (node: LTreeNode<T>, options?: { skipFocus?: boolean }) => this._onCheckboxToggle(node, options),
			onNodeRightClicked: this._onNodeRightClicked.bind(this),
			onNodeDragStart: this._onNodeDragStart.bind(this),
			onNodeDragOver: this._onNodeDragOver.bind(this),
			onNodeDragLeave: this._onNodeDragLeave.bind(this),
			onNodeDrop: this._onNodeDrop.bind(this),
			onZoneDrop: this._onZoneDrop.bind(this),
			onTouchDragStart: this._onTouchStart.bind(this),
			onTouchDragMove: this._onTouchMove.bind(this),
			onTouchDragEnd: this._onTouchEnd.bind(this)
		};

		// ── Initial nodeConfig ──────────────────────────────────────────
		this.nodeConfig = {
			clickBehavior: this.clickBehavior,
			shouldShowCheckboxes: this.shouldShowCheckboxes,
			checkboxMode: this.checkboxMode,
			shouldClickToggleCheckbox: this.shouldClickToggleCheckbox,
			expandIconClass: this.expandIconClass,
			collapseIconClass: this.collapseIconClass,
			leafIconClass: this.leafIconClass,
			toggleIconMode: this.toggleIconMode,
			highlightedNodeClass: this.highlightedNodeClass,
			focusedNodeClass: this.focusedNodeClass,
			nodeClass: this.nodeClass,
			nodeContentClass: this.nodeContentClass,
			dragOverNodeClass: this.dragOverNodeClass,
			dropZoneMode: this.dropZoneMode,
			dropZoneLayout: this.dropZoneLayout,
			dropZoneStart: this.dropZoneStart,
			dropZoneMaxWidth: this.dropZoneMaxWidth,
			isCopyAllowed: this.isCopyAllowed,
			isAccordionExpand: this.isAccordionExpand
		};

		// ── Initialize default navigation strategy ─────────────────────
		this.navigation = this.createDefaultNavigation();

		// ── Effects ─────────────────────────────────────────────────────
		// IMPORTANT: These $effect() calls bind to the lifecycle of whichever
		// component instantiates this class. Must be created during component init.

		// Sync treePathSeparator → LTree
		$effect(() => {
			this.tree.treePathSeparator = this.treePathSeparator;
		});

		// Mutate (don't replace) nodeConfig so the context reference stays the same.
		// Using $state() (not .raw()) so the proxy makes property reads reactive in Node.svelte.
		$effect(() => {
			Object.assign(this.nodeConfig, {
				clickBehavior: this.clickBehavior,
				shouldShowCheckboxes: this.shouldShowCheckboxes,
				shouldClickToggleCheckbox: this.shouldClickToggleCheckbox,
				expandIconClass: this.expandIconClass,
				collapseIconClass: this.collapseIconClass,
				leafIconClass: this.leafIconClass,
				toggleIconMode: this.toggleIconMode,
				highlightedNodeClass: this.highlightedNodeClass,
				focusedNodeClass: this.focusedNodeClass,
				nodeClass: this.nodeClass,
				nodeContentClass: this.nodeContentClass,
				dragOverNodeClass: this.dragOverNodeClass,
				dropZoneMode: this.dropZoneMode,
				dropZoneLayout: this.dropZoneLayout,
				dropZoneStart: this.dropZoneStart,
				dropZoneMaxWidth: this.dropZoneMaxWidth,
				isCopyAllowed: this.isCopyAllowed,
				isAccordionExpand: this.isAccordionExpand
			});
		});

		// Filter when searchText changes
		$effect(() => {
			this.tree.filterNodes(this.searchText as string);
		});

		// InsertArray when data changes
		$effect(() => {
			if (this.tree && this.data) {
				if (this._skipInsertArray) {
					this._skipInsertArray = false;
					return;
				}
				this.renderCoordinator?.reset();
				this.flatRenderedIds = new Set();
				this.flatRenderQueue = [];
				this.currentBatchSize = 0;
				// Reset virtual scroll measurements
				this.vsMeasuredRowHeight = null;
				this.vsDetectedHeight = null;
				this.insertResult = this.tree.insertArray(this.data);

				// Seed selectedPaths from node.isSelected flags written by insertArray
				if (this.tree.isSelectedMember || this.tree.getIsSelectedCallback) {
					const seeded = new Set<string>();
					const walk = (node: LTreeNode<T>) => {
						if (node.isSelected) seeded.add(node.path);
						for (const key in node.children) walk(node.children[key]!);
					};
					for (const key in this.tree.root.children) walk(this.tree.root.children[key]!);
					this.selectedPaths = seeded;
				}
			}
		});

		// Progressive rendering for flat mode
		$effect(() => {
			if (!this.isFlatRenderingEnabled || !this.isProgressiveRender || !this.tree?.visibleFlatNodes)
				return;

			const tracker = this.tree.changeTracker;
			if (tracker === this.lastFlatNodesTracker) return;
			this.lastFlatNodesTracker = tracker;

			const allNodes = this.tree.visibleFlatNodes;
			const currentIds = new Set(allNodes.map((n) => String(n.id)));

			const renderedSnapshot = new Set(this.flatRenderedIds);
			const queueSnapshot = new Set(this.flatRenderQueue);

			const newIds: string[] = [];
			for (const node of allNodes) {
				const id = String(node.id);
				if (!renderedSnapshot.has(id) && !queueSnapshot.has(id)) {
					newIds.push(id);
				}
			}

			const removedIds: string[] = [];
			for (const id of renderedSnapshot) {
				if (!currentIds.has(id)) {
					removedIds.push(id);
				}
			}

			if (removedIds.length > 0) {
				const newRendered = new Set(renderedSnapshot);
				for (const id of removedIds) {
					newRendered.delete(id);
				}
				this.flatRenderedIds = newRendered;
			}

			if (newIds.length > 0) {
				const alreadyHasManyNodes = renderedSnapshot.size > 1000;
				const addingFewNodes = newIds.length < 200;

				if (alreadyHasManyNodes && addingFewNodes) {
					this.flatRenderedIds = new Set([...this.flatRenderedIds, ...newIds]);
				} else {
					this.currentBatchSize = this.initialBatchSize;
					const immediateBatch = newIds.slice(0, this.currentBatchSize);
					const remaining = newIds.slice(this.currentBatchSize);

					if (immediateBatch.length > 0) {
						this.flatRenderedIds = new Set([...this.flatRenderedIds, ...immediateBatch]);
					}

					this.currentBatchSize = Math.min(this.currentBatchSize * 2, this.maxBatchSize);

					if (remaining.length > 0) {
						this.flatRenderQueue = [...remaining];
						this.scheduleFlatRenderBatch();
					}
				}
			}
		});

		// Virtual scroll: auto-measure row height from first rendered node
		$effect(() => {
			if (!this.vsActive || this.virtualRowHeight || this.vsMeasuredRowHeight) return;
			if (this.allFlatNodes.length === 0) return;
			tick().then(() => {
				if (this.vsContainerRef) {
					const firstNode = this.vsContainerRef.querySelector('.stv__node');
					if (firstNode) {
						const height = firstNode.getBoundingClientRect().height;
						if (height > 0) this.vsMeasuredRowHeight = height;
					}
				}
			});
		});

		// Virtual scroll: auto-detect container height from parent element
		$effect(() => {
			if (!this.vsActive || this.virtualContainerHeight || this.vsDetectedHeight) return;
			tick().then(() => {
				if (this.vsContainerRef?.parentElement) {
					const parentHeight = this.vsContainerRef.parentElement.clientHeight;
					if (parentHeight > 100) {
						this.vsDetectedHeight = parentHeight + 'px';
					}
				}
			});
		});

		// Virtual scroll: clamp scroll position when content shrinks (e.g. after filter)
		// Without this, vsScrollTop stays at its old (large) value while vsTotalHeight
		// drops, so vsStartIndex falls out of range and the rendered slice is empty —
		// the scroll appears stuck because the browser silently clamps the container's
		// actual scrollTop but our derived state never re-reads it.
		$effect(() => {
			if (!this.vsActive || !this.vsContainerRef) return;
			const maxScrollTop = Math.max(
				0,
				this.vsTotalHeight - this.vsContainerRef.clientHeight
			);
			if (this.vsScrollTop > maxScrollTop) {
				this.vsScrollTop = maxScrollTop;
				if (this.vsContainerRef.scrollTop > maxScrollTop) {
					this.vsContainerRef.scrollTop = maxScrollTop;
				}
			}
		});

		// Context menu global event listeners
		$effect(() => {
			if (this.contextMenuVisible) {
				const handleGlobalClick = (event: MouseEvent) => {
					const target = event.target as Element;
					if (!target.closest('.stv__context-menu')) {
						this.closeContextMenu();
					}
				};

				const handleGlobalScroll = () => {
					this.closeContextMenu();
				};

				document.addEventListener('click', handleGlobalClick);
				document.addEventListener('contextmenu', handleGlobalClick);
				window.addEventListener('scroll', handleGlobalScroll, true);
				document.addEventListener('scroll', handleGlobalScroll, true);
				window.addEventListener('wheel', handleGlobalScroll, { passive: true });

				return () => {
					document.removeEventListener('click', handleGlobalClick);
					document.removeEventListener('contextmenu', handleGlobalClick);
					window.removeEventListener('scroll', handleGlobalScroll, true);
					document.removeEventListener('scroll', handleGlobalScroll, true);
					window.removeEventListener('wheel', handleGlobalScroll);
				};
			}
		});

		// Debug context menu
		$effect(() => {
			if (
				this.shouldDisplayContextMenuInDebugMode &&
				(this.hasContextMenuSnippet || this.getContextMenuItemsHandler) &&
				this.tree?.tree &&
				this.tree.tree.length > 0
			) {
				const targetNode =
					this.tree.tree.length > 1 ? this.tree.tree[1] : this.tree.tree[0];
				if (targetNode && this.containerElement) {
					const treeRect = this.containerElement.getBoundingClientRect();
					this.contextMenuNode = targetNode;
					this.contextMenuX = treeRect.left + 200;
					this.contextMenuY = treeRect.top + 100;
					this.contextMenuVisible = true;
					this.isDebugMenuActive = true;
				}
			} else if (!this.shouldDisplayContextMenuInDebugMode && this.isDebugMenuActive) {
				this.contextMenuVisible = false;
				this.contextMenuNode = null;
				this.isDebugMenuActive = false;
			}
		});

		// Mirror hoveredNodeForDrop → dragOverNodeClass on a single DOM element.
		// Direct classList mutation (same approach as the touch path's updateDropTarget) so
		// the cost is O(1) per node-crossing — no per-Node prop propagation across the tree.
		let prevHoveredDragPath: string | null = null;
		let prevDragOverClass: string | null = null;
		$effect(() => {
			const current = this.hoveredNodeForDrop?.path ?? null;
			const cls = this.dragOverNodeClass ?? null;
			if (current === prevHoveredDragPath && cls === prevDragOverClass) return;

			const root: ParentNode = this.containerElement ?? document;
			if (prevHoveredDragPath && prevDragOverClass) {
				root.querySelector(
					`[data-tree-path="${prevHoveredDragPath}"] .stv__node-content`
				)?.classList.remove(prevDragOverClass);
			}
			if (current && cls) {
				root.querySelector(
					`[data-tree-path="${current}"] .stv__node-content`
				)?.classList.add(cls);
			}
			prevHoveredDragPath = current;
			prevDragOverClass = cls;
		});
	}

	// ── Virtual scroll handler ──────────────────────────────────────────

	handleVirtualScroll = (event: Event) => {
		if (this.vsRafPending) return;
		this.vsRafPending = true;
		requestAnimationFrame(() => {
			this.vsScrollTop = (event.target as HTMLElement).scrollTop;
			this.vsRafPending = false;
		});
	};

	// ── Public API methods ──────────────────────────────────────────────

	async expandNodes(
		nodePath: string | string[],
		options?: { exclusive?: boolean; noEmit?: boolean }
	) {
		this.tree.expandNodes(nodePath, options);
	}

	async collapseNodes(nodePath: string | string[], options?: { noEmit?: boolean }) {
		this.tree.collapseNodes(nodePath, options);
	}

	expandAll(
		nodePath?: string | string[] | null | undefined,
		options?: { exclusive?: boolean; noEmit?: boolean }
	) {
		this.tree?.expandAll(nodePath, options);
	}

	collapseAll(
		nodePath?: string | string[] | null | undefined,
		options?: { noEmit?: boolean }
	) {
		this.tree?.collapseAll(nodePath, options);
	}

	filterNodes(searchTextVal: string, searchOptions?: SearchOptions): void {
		this.tree?.filterNodes(searchTextVal, searchOptions);
	}

	searchNodes(
		searchTextVal: string | null | undefined,
		searchOptions?: SearchOptions
	): LTreeNode<T>[] {
		return this.tree?.searchNodes(searchTextVal, searchOptions) || [];
	}

	getChildren(parentPath: string): LTreeNode<T>[] {
		return this.tree?.getChildren(parentPath) || [];
	}

	getSiblings(path: string): LTreeNode<T>[] {
		return this.tree?.getSiblings(path) || [];
	}

	/**
	 * Build the shared { path, node, parent, siblings } pointer for a node the tree already
	 * holds — used to give on* events and the clipboard callbacks the same relational context.
	 * Pass the live node (preferred) or just a path (e.g. a pre-removal snapshot, where the
	 * node is gone and only the path is known). Missing parent/siblings resolve to null/[].
	 */
	nodeRef(nodeOrPath: LTreeNode<T> | string | null): NodeRef<T> {
		const node =
			typeof nodeOrPath === 'string' ? this.tree?.getNodeByPath(nodeOrPath) ?? null : nodeOrPath;
		if (!node) {
			return {
				path: typeof nodeOrPath === 'string' ? nodeOrPath : '',
				node: null,
				parent: null,
				siblings: []
			};
		}
		const parentPath = node.parentPath;
		return {
			path: node.path,
			node,
			parent: parentPath ? this.tree?.getNodeByPath(parentPath) ?? null : null,
			siblings: this.getChildren(parentPath ?? '')
		};
	}

	/**
	 * The effective top-level set being dragged: when the grabbed node is part of a
	 * same-tree multi-highlight, the draggable top-level highlighted subtrees (the same set
	 * the multi-drag move loop uses); otherwise just the grabbed node. Used to populate
	 * `dragged` on the drag/drop event contexts. Call BEFORE a move mutates the highlight set.
	 */
	private _draggedTopLevel(draggedNode: LTreeNode<T>): LTreeNode<T>[] {
		const isSameTree = draggedNode.treeId === this.treeId;
		if (
			isSameTree &&
			this.highlightedPaths.has(draggedNode.path) &&
			this.highlightedPaths.size > 1
		) {
			const set = this._getTopLevelHighlightedPaths()
				.map((p) => this.tree?.getNodeByPath(p) ?? null)
				.filter((n): n is LTreeNode<T> => !!n && this.getNodeIsDraggable(n));
			if (set.length) return set;
		}
		return [draggedNode];
	}

	/**
	 * The full top-level dragged set as NodeRefs, correct for BOTH same-tree and
	 * cross-tree drags — the single source of `ctx.dragged` on drag start/over/drop.
	 * Same-tree reads the live highlight set (nodes resolve). Cross-tree can't see the
	 * source's highlight, so it reads the paths the source published on drag start
	 * (getDragSet) and builds path-only refs (node/parent null cross-tree, as documented);
	 * falls back to the lead node alone when no set was published (e.g. touch). Call
	 * BEFORE a move mutates the highlight set.
	 */
	private _draggedRefs(draggedNode: LTreeNode<T> | null): NodeRef<T>[] {
		if (!draggedNode) return [];
		if (draggedNode.treeId === this.treeId) {
			return this._draggedTopLevel(draggedNode).map((n) => this.nodeRef(n));
		}
		const set = getDragSet();
		const paths =
			set && set.sourceTreeId === draggedNode.treeId ? set.paths : [draggedNode.path];
		return paths.map((p) => this.nodeRef(p));
	}

	refreshSiblings(parentPath: string): void {
		this.tree?.refreshSiblings(parentPath);
	}

	refreshNode(path: string): void {
		this.tree?.refreshNode(path);
	}

	getNodeByPath(path: string): LTreeNode<T> | null {
		return this.tree?.getNodeByPath(path) || null;
	}

	// ── Tree editor mutation methods ────────────────────────────────────

	moveNode(
		sourcePath: string,
		targetPath: string,
		position: 'before' | 'after' | 'child'
	): { success: boolean; error?: string } {
		this._skipInsertArray = true;
		// Capture the affected path set BEFORE the move: any highlighted /
		// selected path that is the source itself or a descendant of it needs
		// to be remapped onto the new location. Without this the path Sets
		// keep stale strings after a multi-drag, so subsequent operations work
		// on dangling paths and `_clearAllHighlightFlags` can't find the moved
		// nodes to reset their isHighlighted flag. Mirrors web-treeview's fix.
		const sourceNode = this.tree?.getNodeByPath(sourcePath);
		const sep = this.treePathSeparator;
		const collect = (paths: Set<string>): Map<string, string> => {
			const m = new Map<string, string>();
			for (const p of paths) {
				if (p === sourcePath || p.startsWith(sourcePath + sep)) {
					m.set(p, p.substring(sourcePath.length));
				}
			}
			return m;
		};
		const highlightAffected = collect(this.highlightedPaths);
		const selectedAffected = collect(this.selectedPaths);
		const shiftCursorSuffix =
			this._shiftCursor && highlightAffected.has(this._shiftCursor)
				? highlightAffected.get(this._shiftCursor)
				: undefined;
		// Capture the focused node's relative offset too. We can't rely on the held
		// LTreeNode reference "auto-recovering" via in-place .path mutation: a tree
		// rebuild between selection and move orphans focusedNode (a stale object the
		// move never touches), so its .path stays at the old location and the focus
		// styling vanishes. Remap by path like highlight/selected, re-fetching the
		// live node afterwards.
		const focusedSuffix =
			this.focusedNode &&
			(this.focusedNode.path === sourcePath || this.focusedNode.path.startsWith(sourcePath + sep))
				? this.focusedNode.path.substring(sourcePath.length)
				: undefined;

		const result = this.tree?.moveNode(sourcePath, targetPath, position) || {
			success: false,
			error: 'Tree not initialized'
		};

		if (result.success && sourceNode) {
			const newPath = sourceNode.path; // tree.moveNode mutates this in place
			if (highlightAffected.size > 0) {
				const next = new Set(this.highlightedPaths);
				for (const [oldP, suffix] of highlightAffected) {
					next.delete(oldP);
					next.add(newPath + suffix);
				}
				this.highlightedPaths = next; // reassign for $state.raw reactivity
			}
			if (selectedAffected.size > 0) {
				const next = new Set(this.selectedPaths);
				for (const [oldP, suffix] of selectedAffected) {
					next.delete(oldP);
					next.add(newPath + suffix);
				}
				this.selectedPaths = next;
			}
			if (shiftCursorSuffix !== undefined) {
				this._shiftCursor = newPath + shiftCursorSuffix;
			}
			// Re-point focus at the live node now sitting at the new path. Reassigning
			// (rather than trusting in-place mutation) both refreshes a stale orphan
			// reference and triggers $state.raw reactivity so the focus styling and
			// bound focusedNode follow the move.
			if (focusedSuffix !== undefined) {
				const liveFocused = this.tree?.getNodeByPath(newPath + focusedSuffix);
				if (liveFocused) this.focusedNode = liveFocused;
			}
		}

		tick().then(() => {
			this._skipInsertArray = false;
		});
		return result;
	}

	removeNode(
		path: string,
		includeDescendants: boolean = true
	): { success: boolean; node?: LTreeNode<T>; error?: string } {
		this._skipInsertArray = true;
		const result = this.tree?.removeNode(path, includeDescendants) || {
			success: false,
			error: 'Tree not initialized'
		};
		tick().then(() => {
			this._skipInsertArray = false;
		});
		return result;
	}

	addNode(
		parentPath: string,
		nodeData: T,
		pathSegment?: string
	): { success: boolean; node?: LTreeNode<T>; error?: string } {
		this._skipInsertArray = true;
		const result = this.tree?.addNode(parentPath, nodeData, pathSegment) || {
			success: false,
			error: 'Tree not initialized'
		};
		tick().then(() => {
			this._skipInsertArray = false;
		});
		return result;
	}

	updateNode(
		path: string,
		dataUpdates: Partial<T>
	): { success: boolean; node?: LTreeNode<T>; error?: string } {
		this._skipInsertArray = true;
		const result = this.tree?.updateNode(path, dataUpdates) || {
			success: false,
			error: 'Tree not initialized'
		};
		tick().then(() => {
			this._skipInsertArray = false;
		});
		return result;
	}

	applyChanges(changes: TreeChange<T>[]): ApplyChangesResult {
		this._skipInsertArray = true;
		const result = this.tree?.applyChanges(changes) || { successful: 0, failed: [] };
		tick().then(() => {
			this._skipInsertArray = false;
		});
		return result;
	}

	copyNodeWithDescendants(
		sourceNode: LTreeNode<T>,
		targetParentPath: string,
		transformData: (data: T) => T,
		siblingPath?: string,
		position?: 'before' | 'after'
	): { success: boolean; rootNode?: LTreeNode<T>; count: number; error?: string } {
		this._skipInsertArray = true;
		const result = this.tree?.copyNodeWithDescendants(
			sourceNode,
			targetParentPath,
			transformData,
			siblingPath,
			position
		) || { success: false, count: 0, error: 'Tree not initialized' };
		tick().then(() => {
			this._skipInsertArray = false;
		});
		return result;
	}

	// ── Bulk subtree operations ─────────────────────────────────────────

	insertBranch(parentPath: string, data: T[]): InsertBranchResult<T> {
		this._skipInsertArray = true;
		const result = this.tree?.insertBranch(parentPath, data) || {
			success: false,
			count: 0,
			failed: [],
			parentNode: null
		};
		tick().then(() => {
			this._skipInsertArray = false;
		});
		return result;
	}

	replaceBranch(parentPath: string, data: T[]): InsertBranchResult<T> {
		this._skipInsertArray = true;
		const result = this.tree?.replaceBranch(parentPath, data) || {
			success: false,
			count: 0,
			failed: [],
			parentNode: null
		};
		tick().then(() => {
			this._skipInsertArray = false;
		});
		return result;
	}

	deleteBranch(path: string, keepParent?: boolean): DeleteBranchResult<T> {
		this._skipInsertArray = true;
		const result = this.tree?.deleteBranch(path, keepParent) || {
			success: false,
			removedCount: 0,
			error: 'Tree not initialized'
		};
		tick().then(() => {
			this._skipInsertArray = false;
		});
		return result;
	}

	// ── Clipboard operations ───────────────────────────────────────────

	/**
	 * Collect a node and all its descendants into a ClipboardEntry.
	 * Descendants are ordered parent-first with paths relative to the source node.
	 */
	private _collectClipboardEntry(
		node: LTreeNode<T>,
		operation: 'copy' | 'cut',
		rootIndex = 0
	): ClipboardEntry<T> {
		const descendants: ClipboardEntry<T>['descendants'] = [];

		// $state.snapshot deproxies Svelte reactive state into a plain deep clone.
		// structuredClone alone throws ("could not be cloned") when node.data is a
		// $state proxy — which it is for any consumer passing default $state data.
		// The optional copy transform then cleans the snapshot before it's stored, so
		// transient/sensitive fields never travel on the shared clipboard. The context is
		// the SAME NodeTransformContext the paste transform sees (phase: 'copy'), with the
		// real per-node source (path/node/parent/siblings) and target: null (no destination
		// chosen yet).
		const snapshot = (n: LTreeNode<T>, isRoot: boolean): T => {
			const snap = $state.snapshot(n.data) as T;
			if (!this.copyTransformHandler) return snap;
			return this.copyTransformHandler(snap, {
				operation,
				phase: 'copy',
				isRoot,
				index: rootIndex,
				position: null,
				source: this.nodeRef(n),
				target: null
			});
		};

		const walk = (n: LTreeNode<T>) => {
			for (const child of Object.values(n.children)) {
				// relativePath = everything after sourcePath + separator
				const rel = child.path.substring(node.path.length);
				descendants.push({
					relativePath: rel,
					data: snapshot(child, false)
				});
				walk(child);
			}
		};
		walk(node);

		return {
			sourceTreeId: this.treeId,
			sourcePath: node.path,
			data: snapshot(node, true),
			descendants
		};
	}

	/**
	 * Copy nodes to the shared clipboard.
	 * @param paths Specific paths to copy, or uses highlightedPaths if omitted.
	 */
	copyNodes(paths?: string[]): void {
		let pathsToUse = paths ?? [...this.highlightedPaths];
		if (pathsToUse.length === 0) return;

		// Interceptor: can modify paths or block
		if (this.beforeCopyHandler) {
			const nodes = pathsToUse
				.map((p) => this.tree.getNodeByPath(p))
				.filter((n): n is LTreeNode<T> => n !== null);
			const result = this.beforeCopyHandler({ operation: 'copy', paths: pathsToUse, nodes });
			if (result === false) return;
			if (Array.isArray(result)) pathsToUse = result;
		}

		const entries: ClipboardEntry<T>[] = [];
		for (let i = 0; i < pathsToUse.length; i++) {
			const node = this.tree.getNodeByPath(pathsToUse[i]);
			if (node) entries.push(this._collectClipboardEntry(node, 'copy', i));
		}
		if (entries.length === 0) return;

		// Clear any previous cut state
		this.cutPaths = new Set();

		setClipboard<T>({
			operation: 'copy',
			entries,
			sourceTreeId: this.treeId
		});
		uiLogger.debug(`[clipboard] Copied ${entries.length} node(s)`);
		this.onCopyHandler?.({
			operation: 'copy',
			paths: pathsToUse,
			nodes: pathsToUse
				.map((p) => this.tree.getNodeByPath(p))
				.filter((n): n is LTreeNode<T> => n !== null)
		});
	}

	/**
	 * Cut nodes to the shared clipboard. Nodes are dimmed but NOT removed until paste.
	 * @param paths Specific paths to cut, or uses highlightedPaths if omitted.
	 */
	cutNodes(paths?: string[]): void {
		let pathsToUse = paths ?? [...this.highlightedPaths];
		if (pathsToUse.length === 0) return;

		// Interceptor: can modify paths or block
		if (this.beforeCutHandler) {
			const nodes = pathsToUse
				.map((p) => this.tree.getNodeByPath(p))
				.filter((n): n is LTreeNode<T> => n !== null);
			const result = this.beforeCutHandler({ operation: 'cut', paths: pathsToUse, nodes });
			if (result === false) return;
			if (Array.isArray(result)) pathsToUse = result;
		}

		const entries: ClipboardEntry<T>[] = [];
		const cutSet = new Set<string>();
		for (let i = 0; i < pathsToUse.length; i++) {
			const p = pathsToUse[i];
			const node = this.tree.getNodeByPath(p);
			if (node) {
				entries.push(this._collectClipboardEntry(node, 'cut', i));
				// Add the node itself and all its descendants to cutPaths for dimming
				cutSet.add(p);
				const walkDim = (n: LTreeNode<T>) => {
					for (const child of Object.values(n.children)) {
						cutSet.add(child.path);
						walkDim(child);
					}
				};
				walkDim(node);
			}
		}
		if (entries.length === 0) return;

		setClipboard<T>({
			operation: 'cut',
			entries,
			sourceTreeId: this.treeId
		});
		this.cutPaths = cutSet;
		uiLogger.debug(`[clipboard] Cut ${entries.length} node(s), dimming ${cutSet.size} paths`);
		// Cut only dims — nodes aren't removed until paste — so they're still live here.
		this.onCutHandler?.({
			operation: 'cut',
			paths: pathsToUse,
			nodes: pathsToUse
				.map((p) => this.tree.getNodeByPath(p))
				.filter((n): n is LTreeNode<T> => n !== null)
		});
	}

	/**
	 * Paste clipboard content under (or beside) the target node.
	 * @param targetPath Where to paste
	 * @param transformData Consumer callback to generate new IDs/paths for pasted data
	 * @param position 'child' (default), 'before', or 'after'
	 */
	pasteNodes(
		targetPath: string,
		transformData?: ((data: T, ctx: NodeTransformContext<T>) => T | null) | null,
		position: 'child' | 'before' | 'after' = 'child'
	): PasteResult<T> {
		const clip = getClipboard<T>();
		if (!clip || clip.entries.length === 0) {
			return { success: false, count: 0, skipped: 0, error: 'Clipboard is empty' };
		}
		const operation = clip.operation;
		const sep = this.treePathSeparator;

		// Per-paste working copy: the clipboard is a persistent singleton (a copy can be
		// pasted again), so we never hand out or mutate its entries. Everything below —
		// beforePaste inspection, the per-node transform — operates on this deep copy.
		const workEntries: ClipboardEntry<T>[] = clip.entries.map((e) => ({
			sourceTreeId: e.sourceTreeId,
			sourcePath: e.sourcePath,
			data: $state.snapshot(e.data) as T,
			descendants: e.descendants.map((d) => ({
				relativePath: d.relativePath,
				data: $state.snapshot(d.data) as T
			}))
		}));

		// Leaf-aware paste position: if asked to paste as a child of a node that does
		// not allow 'child' drops (per getNodeAllowedDropPositions — e.g. a file/leaf),
		// place the copies beside it instead, inside its parent. Mirrors the drag-drop
		// position rules so a single allowed-positions config governs both gestures and
		// consumers don't re-implement it. No restriction (null/empty) accepts children.
		if (position === 'child' && targetPath !== '') {
			const targetForChild = this.tree?.getNodeByPath(targetPath);
			if (targetForChild) {
				const allowed = this.getNodeAllowedDropPositions(targetForChild);
				if (allowed && allowed.length > 0 && !allowed.includes('child')) {
					targetPath = targetForChild.parentPath ?? '';
				}
			}
		}

		// Interceptor: batch policy only — redirect target/position or block. It gets the
		// resolved target node + readonly entries (no per-node data rewriting; that's the
		// transform's job).
		if (this.beforePasteHandler) {
			const result = this.beforePasteHandler({
				operation,
				target: {
					path: targetPath,
					node: targetPath ? this.tree.getNodeByPath(targetPath) ?? null : null
				},
				entries: workEntries
			});
			if (result === false) {
				const blocked: PasteResult<T> = { success: false, count: 0, skipped: 0, error: 'Paste blocked by beforePasteCallback' };
				this.onPasteHandler?.(blocked);
				return blocked;
			}
			if (result && typeof result === 'object') {
				if (result.targetPath !== undefined) targetPath = result.targetPath;
				if (result.position !== undefined) position = result.position;
			}
		}

		// Re-evaluate after possible interceptor override
		const isRootPasteAfter = targetPath === '';
		const targetNodeAfter = isRootPasteAfter ? null : this.tree.getNodeByPath(targetPath);
		if (!isRootPasteAfter && !targetNodeAfter) {
			const notFound: PasteResult<T> = { success: false, count: 0, skipped: 0, error: `Target node not found: ${targetPath}` };
			this.onPasteHandler?.(notFound);
			return notFound;
		}

		// Resolve the actual parent the roots land in (children of it = the siblings).
		const destParentPath = isRootPasteAfter
			? ''
			: position === 'child'
				? targetPath
				: targetNodeAfter!.parentPath ?? '';

		const transform = transformData ?? this.pasteTransformHandler ?? null;
		const apply = (data: T, ctx: NodeTransformContext<T>): T | null =>
			transform ? transform(data, ctx) : data;
		const sameTree = clip.sourceTreeId === this.treeId;

		// When shouldAutoHandlePaste=false, don't modify the tree — just forward the
		// working-copy entries (already cleaned via copy transform) to the consumer.
		if (!this.shouldAutoHandlePaste) {
			const result: PasteResult<T> = {
				success: true,
				count: workEntries.length,
				skipped: 0,
				entries: workEntries,
				operation,
				targetPath,
				position
			};
			this.cutPaths = new Set();
			if (operation === 'cut') clearClipboard();
			uiLogger.debug(`[clipboard] shouldAutoHandlePaste=false — forwarding ${workEntries.length} entries to consumer`);
			this.onPasteHandler?.(result);
			return result;
		}

		this._skipInsertArray = true;
		let totalCount = 0;
		let skipped = 0;
		let lastError: string | undefined;
		const pastedSourcePaths: string[] = [];

		// Build the per-node context with LIVE references, symmetric on both sides:
		// `source` = the origin node (+ its parent/siblings), `target` = the node you aimed
		// at (+ its parent/siblings), with `position` saying how the roots land relative to
		// it. Nodes are re-resolved per call, so target.node.children / target.siblings
		// already include nodes added earlier in THIS paste — batch-aware, no accumulator.
		const ctxFor = (
			anchorPath: string,
			pos: 'child' | 'before' | 'after',
			isRoot: boolean,
			idx: number,
			srcPath: string
		): NodeTransformContext<T> => {
			const srcNode = sameTree ? this.tree.getNodeByPath(srcPath) ?? null : null;
			const srcParentPath = srcNode?.parentPath ?? null;
			const tgtNode = anchorPath ? this.tree.getNodeByPath(anchorPath) ?? null : null;
			const tgtParentPath = tgtNode?.parentPath ?? null;
			return {
				operation,
				phase: 'paste',
				isRoot,
				index: idx,
				position: pos,
				source: {
					path: srcPath,
					node: srcNode,
					parent: srcParentPath ? this.tree.getNodeByPath(srcParentPath) ?? null : null,
					siblings: srcNode ? this.getChildren(srcParentPath ?? '') : []
				},
				target: {
					path: anchorPath,
					node: tgtNode,
					parent: tgtParentPath ? this.tree.getNodeByPath(tgtParentPath) ?? null : null,
					siblings: this.getChildren(tgtParentPath ?? '')
				}
			};
		};

		for (let index = 0; index < workEntries.length; index++) {
			const entry = workEntries[index];

			// Per-entry self-paste guard: skip (don't abort the batch) an entry whose
			// destination is itself or its own descendant. Skipping one no longer drops
			// the rest — selecting a folder + its child still pastes the valid nodes.
			if (sameTree && !isRootPasteAfter &&
				(destParentPath === entry.sourcePath || destParentPath.startsWith(entry.sourcePath + sep))) {
				skipped++;
				continue;
			}

			const rootData = apply(entry.data, ctxFor(targetPath, position, true, index, entry.sourcePath));
			if (rootData === null) { skipped++; continue; } // transform vetoed this entry

			const addResult =
				isRootPasteAfter || position === 'child'
					? this.tree.addNode(targetPath, rootData)
					: this.tree.addNode(targetNodeAfter!.parentPath ?? '', rootData);

			if (!addResult.success || !addResult.node) {
				lastError = addResult.error;
				skipped++;
				continue;
			}
			totalCount++;
			pastedSourcePaths.push(entry.sourcePath);

			// Descendants from the snapshot. A descendant the transform vetoes (null)
			// takes its own subtree with it (parent-first order makes this a prefix skip).
			const skippedDescRel = new Set<string>();
			for (const desc of entry.descendants) {
				const parentRel = desc.relativePath.substring(0, desc.relativePath.lastIndexOf(sep));
				if (parentRel && skippedDescRel.has(parentRel)) {
					skippedDescRel.add(desc.relativePath);
					skipped++;
					continue;
				}
				const descParentPath = parentRel ? addResult.node.path + parentRel : addResult.node.path;
				const descData = apply(
					desc.data,
					ctxFor(descParentPath, 'child', false, index, entry.sourcePath + desc.relativePath)
				);
				if (descData === null) {
					skippedDescRel.add(desc.relativePath);
					skipped++;
					continue;
				}
				const descResult = this.tree.addNode(descParentPath, descData);
				if (descResult.success) totalCount++;
				else skipped++;
			}
		}

		// Cut = move: remove only the sources we actually pasted (skipped cuts stay put).
		// Same-tree removes directly; cross-tree reaches back to the source tree via the
		// registry so a cut-and-paste into another tree also removes the originals (was
		// previously the consumer's job). Sources are top-level roots (their descendants
		// ride along), so includeDescendants=true.
		if (operation === 'cut') {
			if (sameTree) {
				for (const src of pastedSourcePaths) this.tree.removeNode(src, true);
			} else {
				const source = getClipboardTree(clip.sourceTreeId);
				if (source && source !== this) {
					for (const src of pastedSourcePaths) source.removeNode(src, true);
				}
			}
		}

		tick().then(() => {
			this._skipInsertArray = false;
		});

		// Clear cut-dimming. A CUT is a one-shot move, so clear the clipboard; a COPY
		// stays on the clipboard so it can be pasted again (Finder / Explorer convention).
		this.cutPaths = new Set();
		if (operation === 'cut') clearClipboard();

		const result: PasteResult<T> = {
			success: totalCount > 0,
			count: totalCount,
			skipped,
			error: totalCount === 0 ? (lastError ?? (skipped > 0 ? 'All nodes skipped' : 'No nodes pasted')) : undefined
		};
		uiLogger.debug(`[clipboard] Pasted ${totalCount} node(s), skipped ${skipped}`);
		this.onPasteHandler?.(result);
		return result;
	}

	/** Cancel a cut operation — clears dimming and clipboard. */
	cancelCut(): void {
		if (getClipboardOp() === 'cut') {
			clearClipboard();
		}
		this.cutPaths = new Set();
		uiLogger.debug('[clipboard] Cut cancelled');
	}

	/** Check if the shared clipboard has content. */
	hasClipboardContent(): boolean {
		return hasClipboard();
	}

	/** Get the current clipboard operation type. */
	getClipboardOperation(): 'copy' | 'cut' | null {
		return getClipboardOp();
	}

	/** Paths a keyboard shortcut should act on: the highlight set if any, else the
	 *  focused node, else empty. Shared by the built-in copy/cut/delete handling. */
	private _shortcutSelectionPaths(): string[] {
		if (this.highlightedPaths.size > 0) return [...this.highlightedPaths];
		return this.focusedNode ? [this.focusedNode.path] : [];
	}

	/** Keep only the top-level paths in a set — a path whose ancestor is also present
	 *  is dropped (removing/operating on the ancestor covers it). */
	private _topLevelOf(paths: string[]): string[] {
		const set = new Set(paths);
		const sep = this.treePathSeparator;
		return paths.filter((p) => {
			let cursor = p;
			while (cursor.includes(sep)) {
				cursor = cursor.substring(0, cursor.lastIndexOf(sep));
				if (set.has(cursor)) return false;
			}
			return true;
		});
	}

	/**
	 * Remove nodes (and their descendants) from the tree. Defaults to the current
	 * selection (highlight set, else focused node). Runs `beforeDeleteCallback` first
	 * (narrow or block), removes only top-level subtrees, clears highlight + focus of
	 * anything removed, and fires `onDelete`. Deletion is a data mutation, so this is
	 * the single place both the built-in Delete key and consumer code go through.
	 */
	deleteNodes(paths?: string[]): { removed: number; blocked: number } {
		let targets = this._topLevelOf(paths ?? this._shortcutSelectionPaths());
		if (targets.length === 0) return { removed: 0, blocked: 0 };

		if (this.beforeDeleteHandler) {
			const nodes = targets
				.map((p) => this.tree.getNodeByPath(p))
				.filter((n): n is LTreeNode<T> => n !== null);
			const result = this.beforeDeleteHandler({ paths: targets, nodes });
			if (result === false) return { removed: 0, blocked: targets.length };
			if (Array.isArray(result)) targets = this._topLevelOf(result);
		}

		// Snapshot the target nodes BEFORE removal so onDelete can hand back resolved nodes
		// (the tree no longer holds them once removeNode runs).
		const preRemoval = new Map(targets.map((p) => [p, this.tree.getNodeByPath(p)]));

		let removed = 0;
		let blocked = 0;
		for (const p of targets) {
			if (this.removeNode(p, true).success) removed++;
			else blocked++;
		}
		if (removed > 0) {
			this.clearHighlight();
			this.clearFocus();
			const removedPaths = targets.slice(0, removed);
			this.onDeleteHandler?.({
				paths: removedPaths,
				nodes: removedPaths
					.map((p) => preRemoval.get(p))
					.filter((n): n is LTreeNode<T> => n != null)
			});
			uiLogger.debug(`[delete] Removed ${removed} node(s), ${blocked} failed`);
		}
		return { removed, blocked };
	}

	/**
	 * Built-in keyboard shortcuts, opt-in via `shouldHandleKeyboardShortcuts`. Returns
	 * true when it consumed the event (caller should preventDefault + stop). A consumer
	 * `onTreeKeydown` runs BEFORE this in Tree.svelte, so it can override or suppress any
	 * of these. Shared by Tree.svelte and the canvas renderer.
	 *   Ctrl/Cmd+C copy · Ctrl/Cmd+X cut · Ctrl/Cmd+V paste (into focused node / root,
	 *   via pasteNodeTransformationCallback) · Delete remove selection · Escape cancel cut.
	 *   Classic CUA aliases too: Ctrl+Insert copy · Shift+Insert paste · Shift+Delete cut.
	 */
	handleShortcutKeydown(event: KeyboardEvent): boolean {
		if (!this.shouldHandleKeyboardShortcuts) return false;
		const mod = event.ctrlKey || event.metaKey;
		const key = event.key.toLowerCase();
		// Classic CUA (old-school) aliases alongside the modern C/X/V:
		//   Ctrl+Insert = copy · Shift+Insert = paste · Shift+Delete = cut.
		const isInsert = event.key === 'Insert';

		// Each branch returns false (not consumed) when there's nothing to act on, so an
		// empty selection lets the browser's native Ctrl+C/V (text copy/paste) through.
		if ((mod && key === 'c') || (event.ctrlKey && isInsert)) {
			const p = this._shortcutSelectionPaths();
			if (!p.length) return false;
			this.copyNodes(p);
			return true;
		}
		// Cut — Ctrl/Cmd+X or Shift+Delete. Checked before the plain-Delete branch below
		// so Shift+Delete cuts rather than deletes.
		if ((mod && key === 'x') || (event.shiftKey && event.key === 'Delete')) {
			const p = this._shortcutSelectionPaths();
			if (!p.length) return false;
			this.cutNodes(p);
			return true;
		}
		if ((mod && key === 'v') || (event.shiftKey && isInsert)) {
			if (!hasClipboard()) return false;
			this.pasteNodes(this.focusedNode?.path ?? '', this.pasteTransformHandler ?? null, 'child');
			return true;
		}
		// Delete selection — plain Delete only (Shift+Delete was cut, handled above).
		if (event.key === 'Delete' && !event.shiftKey) {
			if (!this._shortcutSelectionPaths().length) return false;
			this.deleteNodes();
			return true;
		}
		if (event.key === 'Escape' && getClipboardOp() === 'cut') {
			this.cancelCut();
			return true;
		}
		return false;
	}

	getExpandedPaths(): string[] {
		return this.tree?.getExpandedPaths() || [];
	}

	setExpandedPaths(paths: string[]): void {
		this.tree?.setExpandedPaths(paths);
	}

	getAllData(): T[] {
		return this.tree?.getAllData() || [];
	}

	/** Open the context menu at the given screen coordinates (offsets are applied automatically). */
	openContextMenu(node: LTreeNode<T>, screenX: number, screenY: number) {
		this.contextMenuNode = node;
		this.contextMenuX = screenX + this.contextMenuXOffset;
		this.contextMenuY = screenY + this.contextMenuYOffset;
		this.contextMenuVisible = true;
		this.isDebugMenuActive = false;
	}

	// svelte-ignore non_reactive_update
	closeContextMenu() {
		this.contextMenuVisible = false;
		this.contextMenuNode = null;
		this.isDebugMenuActive = false;
	}

	// ── Public Drag-and-Drop API for custom renderers ────────────────

	/** Call from ondragstart. Sets up dataTransfer, stores drag state, fires callback. */
	startDrag(node: LTreeNode<T>, event: DragEvent): void {
		dragLogger.debug('startDrag', { path: node.path, isDraggable: this.getNodeIsDraggable(node), hasDataTransfer: !!event.dataTransfer });
		if (!this.getNodeIsDraggable(node) || !event.dataTransfer) return;
		event.dataTransfer.effectAllowed = this.isCopyAllowed ? 'copyMove' : 'move';
		event.dataTransfer.setData('application/svelte-treeview', JSON.stringify(node));
		const displayValue = this.tree.getNodeDisplayValue(node);
		if (displayValue) event.dataTransfer.setData('text/plain', displayValue);
		this._onNodeDragStart(node, event);
	}

	/** Call from ondragover. preventDefault, calculates drop position, updates hover state.
	 *  Pass `element` for position calculation (before/after/child based on cursor). */
	dragOver(node: LTreeNode<T>, event: DragEvent, element?: HTMLElement): void {
		if (!event.dataTransfer?.types.includes('application/svelte-treeview')) {
			dragLogger.debug('dragOver SKIP - no svelte-treeview type', { path: node.path, types: Array.from(event.dataTransfer?.types ?? []) });
			return;
		}

		// Cross-tree detection
		let effectiveDraggedNode = this.draggedNode;
		let isCrossTreeDrag = false;
		if (!effectiveDraggedNode) {
			isCrossTreeDrag = true;
			try {
				const data = event.dataTransfer.getData('application/svelte-treeview');
				if (data) effectiveDraggedNode = JSON.parse(data);
			} catch {
				// getData might fail during dragover in some browsers
			}
			this.isDragInProgress = true;
		}

		// Check if drop is allowed by mode
		const dropAllowed = isCrossTreeDrag
			? this.dragDropMode === 'both' || this.dragDropMode === 'cross'
			: this.isDropAllowedByMode(effectiveDraggedNode?.treeId);

		if (!dropAllowed) {
			dragLogger.debug('dragOver REJECTED - mode not allowed', { path: node.path, dragDropMode: this.dragDropMode, isCrossTreeDrag, draggedTreeId: effectiveDraggedNode?.treeId, thisTreeId: this.treeId });
			this.hoveredNodeForDrop = null;
			return;
		}

		// Per-node opt-out gate. Without preventDefault below, the browser
		// won't fire drop, so this suppresses the entire drop on this target.
		// Mirrors the touch path's gate at _updateTouchDragTarget / _onTouchEnd.
		if (!node.isDropAllowed) {
			dragLogger.debug('dragOver REJECTED - node.isDropAllowed=false', { path: node.path });
			this.hoveredNodeForDrop = null;
			return;
		}

		const isValidDrop = effectiveDraggedNode
			? isCrossTreeDrag || effectiveDraggedNode.path !== node.path
			: this.isDragInProgress;

		if (!isValidDrop) {
			dragLogger.debug('dragOver REJECTED - invalid drop (same node?)', { path: node.path, draggedPath: effectiveDraggedNode?.path });
			return;
		}

		event.preventDefault();
		this.hoveredNodeForDrop = node;
		this.currentDropOperation = (this.isCopyAllowed && event.ctrlKey) ? 'copy' : 'move';

		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = this.currentDropOperation;
		}

		// Calculate drop position from element if provided
		if (element) {
			const positions = this.getNodeAllowedDropPositions(node);
			this.activeDropPosition = this.calculateDropPositionFromEvent(event, element, positions);
		} else {
			// Fallback: use event.currentTarget for basic position calculation
			const el = (event.currentTarget || event.target) as Element;
			if (el) {
				this.activeDropPosition = this.calculateDropPosition(event, el);
			}
		}

		dragLogger.debug('dragOver OK', { target: node.path, position: this.activeDropPosition, operation: this.currentDropOperation, hasElement: !!element });
		this.onNodeDragOverHandler?.({
			...this.nodeRef(node),
			event,
			dragged: this._draggedRefs(this.draggedNode)
		});
	}

	/** Call from ondragleave. Clears hover state when cursor leaves element bounds. */
	dragLeave(_node: LTreeNode<T>, event: DragEvent): void {
		const target = event.currentTarget as HTMLElement;
		if (!target) return;
		const rect = target.getBoundingClientRect();
		const x = event.clientX;
		const y = event.clientY;

		if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
			dragLogger.debug('dragLeave', { path: _node.path });
			this.hoveredNodeForDrop = null;
			this.activeDropPosition = null;
		}
	}

	/** Call from ondrop. Uses calculated position or defaults to 'child'. */
	drop(node: LTreeNode<T>, event: DragEvent): void {
		dragLogger.debug('drop called', { target: node.path, draggedNode: this.draggedNode?.path, activeDropPosition: this.activeDropPosition });
		event.preventDefault();
		event.stopPropagation();

		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = (this.isCopyAllowed && event.ctrlKey) ? 'copy' : 'move';
		}

		// Extract dragged node from dataTransfer if not set (cross-tree)
		let isCrossTreeDrag = false;
		if (!this.draggedNode) {
			const data = event.dataTransfer?.getData('application/svelte-treeview');
			dragLogger.debug('drop - no draggedNode, read from dataTransfer:', { hasData: !!data });
			if (data) {
				this.draggedNode = JSON.parse(data);
				isCrossTreeDrag = this.draggedNode?.treeId !== this.treeId;
			}
		}

		if (this.draggedNode) {
			const dropAllowed = isCrossTreeDrag
				? this.dragDropMode === 'both' || this.dragDropMode === 'cross'
				: this.isDropAllowedByMode(this.draggedNode.treeId);

			const sameNode = !isCrossTreeDrag && this.draggedNode.path === node.path;
			dragLogger.debug('drop check', { dropAllowed, isCrossTreeDrag, sameNode, draggedPath: this.draggedNode.path, targetPath: node.path, dragDropMode: this.dragDropMode, nodeIsDropAllowed: node.isDropAllowed });

			// Per-node opt-out gate.
			if (!node.isDropAllowed) {
				dragLogger.debug('drop REJECTED - node.isDropAllowed=false', { path: node.path });
				this._resetDragState();
				return;
			}

			if (dropAllowed && (isCrossTreeDrag || this.draggedNode.path !== node.path)) {
				const position = this.activeDropPosition || 'child';
				dragLogger.debug('drop EXECUTING', { from: this.draggedNode.path, to: node.path, position });
				this._handleDrop(node, this.draggedNode, position, event);
			} else {
				dragLogger.debug('drop REJECTED', { dropAllowed, sameNode });
			}
		} else {
			dragLogger.debug('drop - no draggedNode available, skipping');
		}

		this._resetDragState();
	}

	/** Drop with explicit position (for custom drop zones or floating-style UI). */
	dropAt(node: LTreeNode<T>, position: DropPosition, event: DragEvent | TouchEvent): void {
		dragLogger.debug('dropAt', { target: node.path, position, draggedNode: this.draggedNode?.path });
		if (event instanceof DragEvent) {
			event.preventDefault();

			if (!this.draggedNode) {
				const data = event.dataTransfer?.getData('application/svelte-treeview');
				if (data) {
					this.draggedNode = JSON.parse(data);
				}
			}
		}

		if (this.draggedNode) {
			dragLogger.debug('dropAt EXECUTING', { from: this.draggedNode.path, to: node.path, position });
			this._handleDrop(node, this.draggedNode, position, event);
		} else {
			dragLogger.debug('dropAt - no draggedNode, skipping');
		}

		this._resetDragState();
	}

	/** Cancel current drag and reset all state. */
	cancelDrag(): void {
		dragLogger.debug('Drag cancelled via public API');
		this._resetDragState();
	}

	/** Touch drag start — proxy to internal touch handler. */
	touchStart(node: LTreeNode<T>, event: TouchEvent): void {
		this._onTouchStart(node, event);
	}

	/** Touch drag move — proxy to internal touch handler. */
	touchMove(node: LTreeNode<T>, event: TouchEvent): void {
		this._onTouchMove(node, event);
	}

	/** Touch drag end — proxy to internal touch handler. */
	touchEnd(node: LTreeNode<T>, event: TouchEvent): void {
		this._onTouchEnd(node, event);
	}

	/** Get allowed drop positions for a node (proxies LTree method). */
	getNodeAllowedDropPositions(node: LTreeNode<T>): DropPosition[] | null {
		return this.tree?.getNodeAllowedDropPositions(node) ?? null;
	}

	/** Get whether a node is draggable (proxies LTree resolution: callback > member > node property). */
	getNodeIsDraggable(node: LTreeNode<T>): boolean {
		return this.tree?.getNodeIsDraggable(node) ?? false;
	}

	/** Get whether a node accepts drops (proxies LTree resolution: callback > member > node property). */
	getNodeIsDropAllowed(node: LTreeNode<T>): boolean {
		return this.tree?.getNodeIsDropAllowed(node) ?? false;
	}

	/** Get whether a node is collapsible (proxies LTree resolution: callback > member > node property). */
	getNodeIsCollapsible(node: LTreeNode<T>): boolean {
		return this.tree?.getNodeIsCollapsible(node) ?? true;
	}

	/** Calculate drop position from cursor location within an element (before/after/child).
	 *  Same logic as Node.svelte's calculateGlowPosition, respecting allowed positions. */
	calculateDropPositionFromEvent(
		event: DragEvent | MouseEvent,
		element: HTMLElement,
		allowedPositions?: DropPosition[] | null
	): DropPosition {
		const rect = element.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const width = rect.width;
		const height = rect.height;

		// Calculate the ideal position based on mouse position
		let idealPosition: DropPosition;
		if (x > width / 2) {
			idealPosition = 'child';
		} else if (y < height / 2) {
			idealPosition = 'before';
		} else {
			idealPosition = 'after';
		}

		// If no restrictions, return the ideal position
		if (!allowedPositions || allowedPositions.length === 0) {
			return idealPosition;
		}

		// If the ideal position is allowed, use it
		if (allowedPositions.includes(idealPosition)) {
			return idealPosition;
		}

		// Otherwise, snap to the nearest allowed position
		if (allowedPositions.length === 1) {
			return allowedPositions[0];
		}

		// Multiple positions allowed but not the ideal one
		if (allowedPositions.includes('before') && allowedPositions.includes('after')) {
			return y < height / 2 ? 'before' : 'after';
		}

		return allowedPositions[0];
	}

	async scrollToPath(
		path: string,
		options?: {
			expand?: boolean;
			expandTarget?: boolean;
			highlight?: boolean;
			scrollOptions?: ScrollIntoViewOptions;
			containerScroll?: boolean;
			containerElement?: HTMLElement;
		}
	): Promise<boolean> {
		perfStart(`[${this.treeId}] scrollToPath`);
		const {
			expand = true,
			expandTarget = false,
			highlight = true,
			scrollOptions = { behavior: 'smooth', block: 'center' },
			containerScroll = false,
			containerElement
		} = options || {};

		const node = this.tree.getNodeByPath(path);
		if (!node || !node.id) {
			console.warn(`[Tree ${this.treeId}] Node not found for path: ${path}`);
			perfEnd(`[${this.treeId}] scrollToPath`);
			return false;
		}

		if (expand && node.parentPath) {
			this.tree.expandNodes(node.parentPath);
		}

		if (expandTarget) {
			this.tree.expandNodes(path);
		}

		if (expand || expandTarget) {
			await tick();
		}

		// Virtual scroll: index-based scrolling instead of DOM query
		if (this.vsActive && this.vsContainerRef) {
			const nodeIndex = this.allFlatNodes.findIndex(n => n.path === path);
			if (nodeIndex === -1) {
				console.warn(`[Tree ${this.treeId}] Node not found in flat nodes for path: ${path}`);
				perfEnd(`[${this.treeId}] scrollToPath`);
				return false;
			}

			// Scroll virtual container to center the node
			const targetScroll = nodeIndex * this.vsRowHeight
				- (this.vsContainerRef.clientHeight / 2)
				+ this.vsRowHeight / 2;
			this.vsContainerRef.scrollTo({
				top: Math.max(0, targetScroll),
				behavior: scrollOptions?.behavior || 'smooth'
			});

			// Wait for scroll + re-render — need multiple frames for
			// rAF-throttled scroll handler → reactive update → DOM render
			await tick();
			await new Promise(r => requestAnimationFrame(r));
			await tick();
			await new Promise(r => requestAnimationFrame(r));

			if (highlight && this.scrollHighlightClass) {
				const elementId = `${this.treeId}-${node.id}`;
				if (!this.applyHighlight(elementId)) {
					// Element might not be rendered yet — retry after another frame
					await tick();
					await new Promise(r => requestAnimationFrame(r));
					this.applyHighlight(elementId);
				}
			}

			perfEnd(`[${this.treeId}] scrollToPath`);
			return true;
		}

		const elementId = `${this.treeId}-${node.id}`;
		const rootEl = containerElement || this.containerElement;
		const findContent = (): HTMLElement | null => {
			const el = rootEl
				? rootEl.querySelector(`#${CSS.escape(elementId)}`)
				: document.getElementById(elementId);
			return (el?.querySelector('.stv__node-content') as HTMLElement | null) ?? null;
		};
		// Progressive flat rendering adds newly-revealed rows in rAF-deferred
		// batches (initialBatchSize, doubling each step). After expandNodes +
		// tick() the immediate batch is in DOM but rows past that batch arrive
		// over subsequent frames. Retry across up to ~6 frames before giving up.
		let contentDiv = findContent();
		if (!contentDiv) {
			for (let i = 0; i < 6 && !contentDiv; i++) {
				await new Promise((r) => requestAnimationFrame(r));
				await tick();
				contentDiv = findContent();
			}
		}

		if (!contentDiv) {
			console.warn(`[Tree ${this.treeId}] DOM element not found for node ID: ${elementId}`);
			perfEnd(`[${this.treeId}] scrollToPath`);
			return false;
		}

		if (containerScroll) {
			const container = this.findScrollableAncestor(contentDiv);
			if (container) {
				const containerRect = container.getBoundingClientRect();
				const elementRect = contentDiv.getBoundingClientRect();
				const scrollTop =
					container.scrollTop +
					(elementRect.top - containerRect.top) -
					containerRect.height / 2 +
					elementRect.height / 2;
				container.scrollTo({
					top: scrollTop,
					behavior: scrollOptions?.behavior || 'smooth'
				});
			}
		} else {
			contentDiv.scrollIntoView(scrollOptions);
		}

		if (highlight && this.scrollHighlightClass) {
			this.applyHighlight(elementId);
		}

		perfEnd(`[${this.treeId}] scrollToPath`);
		return true;
	}

	/**
	 * Apply scroll highlight to a node element by ID.
	 * Returns true if the element was found and highlighted, false otherwise.
	 */
	private applyHighlight(elementId: string): boolean {
		const rootEl = this.containerElement;
		const element = rootEl
			? rootEl.querySelector(`#${CSS.escape(elementId)}`)
			: document.getElementById(elementId);
		const contentDiv = element?.querySelector('.stv__node-content') as HTMLElement | null;

		if (!contentDiv || !this.scrollHighlightClass) return false;

		if (this.currentHighlight) {
			this.currentHighlight.element.classList.remove(this.scrollHighlightClass);
			clearTimeout(this.currentHighlight.timeoutId);
			this.currentHighlight = null;
		}

		contentDiv.classList.add(this.scrollHighlightClass);
		const highlightClass = this.scrollHighlightClass;
		const timeoutId = setTimeout(() => {
			contentDiv.classList.remove(highlightClass);
			this.currentHighlight = null;
		}, this.scrollHighlightTimeout);

		this.currentHighlight = { element: contentDiv, timeoutId };
		return true;
	}

	// ── updateProps (for external JS usage) ─────────────────────────────

	updateProps(updates: Partial<TreeControllerProps<T>>) {
		if (updates.treeId !== undefined) this.treeId = updates.treeId || this.treeId;
		if (updates.treePathSeparator !== undefined)
			this.treePathSeparator = updates.treePathSeparator ?? '.';
		if (updates.data !== undefined) this.data = updates.data;
		if (updates.focusedNode !== undefined) this._setFocusedNode(updates.focusedNode ?? null);
		if (updates.highlightedPaths !== undefined) this.highlightedPaths = updates.highlightedPaths ?? new Set();
		if (updates.selectedPaths !== undefined) this.selectedPaths = updates.selectedPaths ?? new Set();
		if (updates.searchText !== undefined) this.searchText = updates.searchText;
		if (updates.shouldDisplayDebugInformation !== undefined)
			this.shouldDisplayDebugInformation = updates.shouldDisplayDebugInformation;
		if (updates.rangeSelectionMode !== undefined)
			this.rangeSelectionMode = updates.rangeSelectionMode ?? 'visual';
		if (updates.shouldDisplayContextMenuInDebugMode !== undefined)
			this.shouldDisplayContextMenuInDebugMode =
				updates.shouldDisplayContextMenuInDebugMode ?? false;
		if (updates.isLoading !== undefined) this.isLoading = updates.isLoading ?? false;
		if (updates.bodyClass !== undefined) this.bodyClass = updates.bodyClass;

		if (updates.isVirtualScrollEnabled !== undefined) this.isVirtualScrollEnabled = updates.isVirtualScrollEnabled ?? false;
		if (updates.virtualRowHeight !== undefined) this.virtualRowHeight = updates.virtualRowHeight;
		if (updates.virtualOverscan !== undefined) this.virtualOverscan = updates.virtualOverscan ?? 5;
		if (updates.virtualContainerHeight !== undefined) this.virtualContainerHeight = updates.virtualContainerHeight;

		if (updates.clickBehavior !== undefined)
			this.clickBehavior = updates.clickBehavior ?? 'expand-and-focus';
		if (updates.selectionMode !== undefined)
			this.selectionMode = updates.selectionMode ?? 'single';
		if (updates.shouldShowCheckboxes !== undefined)
			this.shouldShowCheckboxes = updates.shouldShowCheckboxes ?? false;
		if (updates.checkboxMode !== undefined)
			this.checkboxMode = updates.checkboxMode ?? 'independent';
		if (updates.shouldClickToggleCheckbox !== undefined)
			this.shouldClickToggleCheckbox = updates.shouldClickToggleCheckbox ?? false;
		if (updates.beforeCheckboxToggleCallback !== undefined)
			this.beforeCheckboxToggleHandler = updates.beforeCheckboxToggleCallback;
		if (updates.expandIconClass !== undefined)
			this.expandIconClass = updates.expandIconClass ?? 'stv__toggle-icon--expand';
		if (updates.collapseIconClass !== undefined)
			this.collapseIconClass = updates.collapseIconClass ?? 'stv__toggle-icon--collapse';
		if (updates.leafIconClass !== undefined)
			this.leafIconClass = updates.leafIconClass ?? 'stv__toggle-icon--leaf';
		if (updates.highlightedNodeClass !== undefined)
			this.highlightedNodeClass = updates.highlightedNodeClass;
		if (updates.focusedNodeClass !== undefined)
			this.focusedNodeClass = updates.focusedNodeClass;
		if (updates.nodeClass !== undefined) this.nodeClass = updates.nodeClass;
		if (updates.nodeContentClass !== undefined) this.nodeContentClass = updates.nodeContentClass;
		if (updates.dragOverNodeClass !== undefined)
			this.dragOverNodeClass = updates.dragOverNodeClass;
		if (updates.dropZoneMode !== undefined)
			this.dropZoneMode = updates.dropZoneMode ?? 'glow';
		if (updates.dropZoneLayout !== undefined)
			this.dropZoneLayout = updates.dropZoneLayout ?? 'around';
		if (updates.dropZoneStart !== undefined)
			this.dropZoneStart = updates.dropZoneStart ?? 33;
		if (updates.dropZoneMaxWidth !== undefined)
			this.dropZoneMaxWidth = updates.dropZoneMaxWidth ?? 120;
		if (updates.isCopyAllowed !== undefined) this.isCopyAllowed = updates.isCopyAllowed ?? false;
		if (updates.shouldAutoHandleCopy !== undefined)
			this.shouldAutoHandleCopy = updates.shouldAutoHandleCopy ?? true;
		if (updates.shouldAutoHandleMove !== undefined)
			this.shouldAutoHandleMove = updates.shouldAutoHandleMove ?? true;
		if (updates.shouldAutoHandlePaste !== undefined)
			this.shouldAutoHandlePaste = updates.shouldAutoHandlePaste ?? true;
		if (updates.shouldHandleKeyboardShortcuts !== undefined)
			this.shouldHandleKeyboardShortcuts = updates.shouldHandleKeyboardShortcuts ?? false;
		if (updates.dragDropMode !== undefined)
			this.dragDropMode = updates.dragDropMode ?? 'none';
		if (updates.scrollHighlightTimeout !== undefined)
			this.scrollHighlightTimeout = updates.scrollHighlightTimeout ?? 4000;
		if (updates.scrollHighlightClass !== undefined)
			this.scrollHighlightClass = updates.scrollHighlightClass ?? 'stv__node-content--scroll-highlight';
		if (updates.contextMenuXOffset !== undefined)
			this.contextMenuXOffset = updates.contextMenuXOffset ?? 8;
		if (updates.contextMenuYOffset !== undefined)
			this.contextMenuYOffset = updates.contextMenuYOffset ?? 0;

		// Callbacks
		if (updates.onNodeClick !== undefined) this.onNodeClickHandler = updates.onNodeClick;
		if (updates.onNodeDoubleClick !== undefined) this.onNodeDoubleClickHandler = updates.onNodeDoubleClick;
		if (updates.onNodeDragStart !== undefined) this.onNodeDragStartHandler = updates.onNodeDragStart;
		if (updates.onNodeDragOver !== undefined) this.onNodeDragOverHandler = updates.onNodeDragOver;
		if (updates.beforeDropCallback !== undefined)
			this.beforeDropHandler = updates.beforeDropCallback;
		if (updates.beforeCopyCallback !== undefined)
			this.beforeCopyHandler = updates.beforeCopyCallback;
		if (updates.beforeCutCallback !== undefined)
			this.beforeCutHandler = updates.beforeCutCallback;
		if (updates.beforePasteCallback !== undefined)
			this.beforePasteHandler = updates.beforePasteCallback;
		if (updates.beforeDeleteCallback !== undefined)
			this.beforeDeleteHandler = updates.beforeDeleteCallback;
		if (updates.copyNodeTransformationCallback !== undefined)
			this.copyTransformHandler = updates.copyNodeTransformationCallback;
		if (updates.pasteNodeTransformationCallback !== undefined)
			this.pasteTransformHandler = updates.pasteNodeTransformationCallback;
		if (updates.onNodeDrop !== undefined) this.onNodeDropHandler = updates.onNodeDrop;
		if (updates.onCopy !== undefined) this.onCopyHandler = updates.onCopy;
		if (updates.onCut !== undefined) this.onCutHandler = updates.onCut;
		if (updates.onPaste !== undefined) this.onPasteHandler = updates.onPaste;
		if (updates.onDelete !== undefined) this.onDeleteHandler = updates.onDelete;
		if (updates.getContextMenuItemsCallback !== undefined)
			this.getContextMenuItemsHandler = updates.getContextMenuItemsCallback;
		if (updates.onHighlightChange !== undefined)
			this.onHighlightChangeHandler = updates.onHighlightChange;
		if (updates.onSelectionChange !== undefined)
			this.onSelectionChangeHandler = updates.onSelectionChange;
	}

	// ── Internal event handlers ─────────────────────────────────────────

	private async _onNodeClicked(node: LTreeNode<T>, modifiers?: SelectionModifiers, options?: { silent?: boolean; forceMultiSemantics?: boolean; uiClick?: boolean }) {
		if (this.contextMenuVisible) {
			this.closeContextMenu();
		}

		// Manual double-click detection — see the comment on _lastClickPath for why the
		// browser's native dblclick can't be trusted (focus bumps node._rev → flat-mode
		// row is recreated → the 2nd click lands on a fresh element). Runs for every
		// clickBehavior so onNodeDoubleClick fires consistently; the built-in
		// expand/collapse-on-double-click only applies to clickBehavior='select' (the
		// other modes already toggle on single click). On a detected double we consume
		// the 2nd click (return early) so the gesture is a single open, not a re-toggle.
		// Threshold = 400ms, a touch tighter than Windows' 500ms default to avoid
		// coupling unrelated clicks. Gated on uiClick so programmatic highlight/select
		// API calls never get mistaken for a double-click.
		if (options?.uiClick && !modifiers?.ctrl && !modifiers?.shift) {
			const now = Date.now();
			const isDouble =
				this._lastClickPath === node.path &&
				now - this._lastClickTime < 400;
			if (isDouble) {
				this._lastClickPath = null;
				this._lastClickTime = 0;
				this.onNodeDoubleClickHandler?.(this.nodeRef(node));
				if (this.clickBehavior === 'select') {
					const canonical = this.tree.getNodeByPath(node.path) ?? node;
					if (canonical.hasChildren && canonical.isCollapsible !== false) {
						if (canonical.isExpanded) {
							this.collapseNodes(canonical.path);
						} else {
							this.expandNodes(canonical.path);
						}
					}
				}
				return;
			}
			this._lastClickPath = node.path;
			this._lastClickTime = now;
		}

		// In single mode, mouse Ctrl/Shift+click degrade to plain click. Programmatic
		// callers (highlightNode with mode='toggle'/'range') pass forceMultiSemantics
		// to opt out of the gate — the API contract should not depend on selectionMode.
		const isMulti = options?.forceMultiSemantics || this.selectionMode === 'multi';
		const ctrl = isMulti && (modifiers?.ctrl ?? false);
		const shift = isMulti && (modifiers?.shift ?? false);
		const silent = options?.silent ?? false;

		uiLogger.debug(`[highlight] Click on ${node.path}`, { ctrl, shift, mode: this.selectionMode, shiftCursor: this._shiftCursor, prevCount: this.highlightedPaths.size });

		// !isSelectable blocks highlight (and therefore the mirror in no-checkbox mode).
		// Focus still moves so consumers can show detail panels for unselectable rows.
		const canHighlight = node.isSelectable;

		if (ctrl && canHighlight) {
			// Toggle this node in/out of highlight
			const newPaths = new Set([...this.highlightedPaths]);
			if (newPaths.has(node.path)) {
				newPaths.delete(node.path);
				node.isHighlighted = false;
			} else {
				newPaths.add(node.path);
				node.isHighlighted = true;
			}
			node._rev = (node._rev || 0) + 1;
			this.highlightedPaths = newPaths;
			this._shiftCursor = node.path;
		} else if (shift && canHighlight && (this._shiftCursor || this.focusedNode)) {
			// Range highlight from the shift cursor (or focused node if no cursor yet) to this node
			const anchor = this._shiftCursor ?? this.focusedNode!.path;
			const rangePaths = this._getNodesBetween(anchor, node.path);
			this._clearAllHighlightFlags();
			const newPaths = new Set<string>();
			for (const path of rangePaths) {
				const n = this.tree.getNodeByPath(path);
				if (!n || !n.isSelectable) continue;
				newPaths.add(path);
				n.isHighlighted = true;
				n._rev = (n._rev || 0) + 1;
			}
			this.highlightedPaths = newPaths;
			// Anchor stays put on shift+click — _shiftCursor unchanged
		} else if (canHighlight) {
			// Plain click (or Ctrl/Shift+click in single mode → treated as plain):
			// clear all highlights, highlight only this node.
			this._clearAllHighlightFlags();
			node.isHighlighted = true;
			node._rev = (node._rev || 0) + 1;
			this.highlightedPaths = new Set([node.path]);
			this._shiftCursor = node.path;
		} else {
			// Not selectable: clear any prior highlights but don't highlight this row.
			if (this.highlightedPaths.size > 0) {
				this._clearAllHighlightFlags();
				this.highlightedPaths = new Set();
			}
			this._shiftCursor = null;
		}

		// Update focus (always — focus is independent of selectability)
		this._setFocusedNode(node);

		if (!silent) {
			this.onNodeClickHandler?.(this.nodeRef(node));
			this._notifyHighlightChanged();
			this._mirrorHighlightToSelected();
		}
		this.tree.refresh();

		// Focus the tree container so keyboard navigation works after clicking a node.
		// Skip in silent mode — programmatic highlight (e.g. from URL params) shouldn't
		// steal focus from whatever the user is currently interacting with.
		if (!silent) {
			this.containerElement?.focus();
		}
	}

	/**
	 * Top-level paths within `highlightedPaths` — paths whose nearest highlighted
	 * ancestor is NOT in the highlighted set. Used by multi-drag to figure out
	 * which subtrees actually need to move (descendants ride along inside).
	 */
	private _getTopLevelHighlightedPaths(): string[] {
		const paths = this.highlightedPaths;
		if (paths.size === 0) return [];
		const sep = this.treePathSeparator;
		const result: string[] = [];
		for (const p of paths) {
			let cursor = p;
			let absorbed = false;
			while (cursor.includes(sep)) {
				cursor = cursor.substring(0, cursor.lastIndexOf(sep));
				if (paths.has(cursor)) {
					absorbed = true;
					break;
				}
			}
			if (!absorbed) result.push(p);
		}
		return result;
	}

	/** Get all descendant paths of a node (depth-first) */
	private _getDescendantPaths(node: LTreeNode<T>): string[] {
		const result: string[] = [];
		const traverse = (n: LTreeNode<T>) => {
			for (const child of Object.values(n.children)) {
				result.push(child.path);
				traverse(child);
			}
		};
		traverse(node);
		return result;
	}

	/** Handle checkbox toggle with cascade and interceptor support */
	private _onCheckboxToggle(node: LTreeNode<T>, options?: { skipFocus?: boolean }) {
		// In cascade mode, indeterminate → check all (not fully selected yet)
		const newChecked = this.checkboxMode === 'cascade' && node.visualState === VisualState.indeterminate
			? true
			: !node.isSelected;

		// If the clicked node is part of a multi-highlight, apply to all highlighted nodes
		const isMultiHighlighted = this.highlightedPaths.size > 1 && this.highlightedPaths.has(node.path);

		// Compute affected paths based on checkboxMode and multi-highlight
		let affectedPaths: string[] = [];
		if (isMultiHighlighted) {
			// Start with all highlighted nodes
			affectedPaths = [...this.highlightedPaths];
		} else {
			affectedPaths = [node.path];
		}

		// In cascade mode, also include descendants of each affected node
		if (this.checkboxMode === 'cascade') {
			const expanded = new Set(affectedPaths);
			for (const path of affectedPaths) {
				const n = this.tree.getNodeByPath(path);
				if (n) {
					for (const dp of this._getDescendantPaths(n)) {
						expanded.add(dp);
					}
				}
			}
			affectedPaths = [...expanded];
		}

		// Call interceptor if provided
		if (this.beforeCheckboxToggleHandler) {
			const result = this.beforeCheckboxToggleHandler(node, newChecked, affectedPaths);
			if (result === false) return;
			if (Array.isArray(result)) {
				affectedPaths = result;
			}
		}

		// Apply selection changes
		const newPaths = new Set([...this.selectedPaths]);
		for (const path of affectedPaths) {
			const n = this.tree.getNodeByPath(path);
			if (!n) continue;
			if (newChecked) {
				newPaths.add(path);
				n.isSelected = true;
			} else {
				newPaths.delete(path);
				n.isSelected = false;
			}
			n._rev = (n._rev || 0) + 1;
		}
		this.selectedPaths = newPaths;
		if (!options?.skipFocus) this._setFocusedNode(node);

		// Update visual states for toggled nodes and their ancestors.
		// Only in cascade mode — in independent mode, checkboxes are standalone and
		// parents must not be auto-checked just because their descendants are.
		if (this.checkboxMode === 'cascade') {
			const rootPaths = isMultiHighlighted ? [...this.highlightedPaths] : [node.path];
			for (const rp of rootPaths) {
				const rn = this.tree.getNodeByPath(rp);
				if (!rn) continue;
				const vs = this._computeVisualState(rn);
				if (rn.visualState !== vs) {
					rn.visualState = vs;
					rn._rev = (rn._rev || 0) + 1;
				}
				this._updateAncestorVisualStates(rp);
			}
		}

		this.onNodeClickHandler?.(this.nodeRef(node));
		this._notifySelectionChanged();
		this.tree.refresh();
		if (!options?.skipFocus) this.containerElement?.focus();
	}

	/** Walk up from a node path and set visualState on each ancestor based on descendant selection */
	private _updateAncestorVisualStates(startPath: string) {
		const newPaths = new Set([...this.selectedPaths]);
		let path: string | null | undefined = this.tree.getNodeByPath(startPath)?.parentPath;
		while (path) {
			const ancestor = this.tree.getNodeByPath(path);
			if (!ancestor) break;
			const vs = this._computeVisualState(ancestor);

			// Sync isSelected with visual state: all children selected → parent selected
			const shouldBeSelected = vs === VisualState.selected;
			if (ancestor.isSelected !== shouldBeSelected) {
				ancestor.isSelected = shouldBeSelected;
				if (shouldBeSelected) newPaths.add(path);
				else newPaths.delete(path);
			}

			if (ancestor.visualState !== vs) {
				ancestor.visualState = vs;
			}
			ancestor._rev = (ancestor._rev || 0) + 1;
			path = ancestor.parentPath;
		}
		this.selectedPaths = newPaths;
	}

	/** Compute visual state for a node based on its descendants' isSelected */
	private _computeVisualState(node: LTreeNode<T>): VisualState {
		const children = Object.values(node.children);
		if (children.length === 0) {
			return node.isSelected ? VisualState.selected : VisualState.notSelected;
		}
		let allSelected = true;
		let noneSelected = true;
		const check = (n: LTreeNode<T>) => {
			if (!allSelected && !noneSelected) return; // indeterminate already
			if (n.isSelected) noneSelected = false;
			else allSelected = false;
			for (const child of Object.values(n.children)) {
				if (!allSelected && !noneSelected) return;
				check(child);
			}
		};
		for (const child of children) {
			check(child);
			if (!allSelected && !noneSelected) break;
		}
		if (allSelected) return VisualState.selected;
		if (noneSelected) return VisualState.notSelected;
		return VisualState.indeterminate;
	}

	/** Set focused node, clearing previous focus flag */
	private _setFocusedNode(node: LTreeNode<T> | null) {
		// IMPORTANT: bidirectional bind on `focusedNode` can route the value through
		// the parent's `$state`, which deep-clones the node into a reactive proxy.
		// That clone shares the path but is a different object from the tree's
		// canonical node. We MUST mutate the tree's actual node — otherwise
		// `node.isFocused = false` writes to the clone and the rendered row
		// (which reads the canonical node's flag) never updates. Same applies to
		// the incoming `node`: prefer the tree's canonical ref.
		const prevPath = this.focusedNode?.path;
		if (prevPath && prevPath !== node?.path) {
			const prev = this.tree.getNodeByPath(prevPath);
			if (prev) {
				prev.isFocused = false;
				prev._rev = (prev._rev || 0) + 1;
			}
		}
		const canonical = node ? (this.tree.getNodeByPath(node.path) ?? node) : null;
		if (canonical) {
			canonical.isFocused = true;
			canonical._rev = (canonical._rev || 0) + 1;
		}
		this.focusedNode = canonical;
	}

	/**
	 * Mirror highlightedPaths → selectedPaths when checkboxes are off.
	 * Decision 1 + 10 from selection-highlight-model.md: in no-checkbox mode the
	 * highlight set IS the form selection, so writes to highlightedPaths cascade
	 * to selectedPaths and fire onSelectionChange alongside onHighlightChange.
	 */
	private _mirrorHighlightToSelected() {
		if (this.shouldShowCheckboxes) return;
		// Take a snapshot to avoid identity-loop on parent rebinding
		const next = new Set(this.highlightedPaths);
		// Sync the per-node isSelected flag with the mirrored set.
		// First clear isSelected on anything currently in selectedPaths but not in next.
		for (const path of this.selectedPaths) {
			if (!next.has(path)) {
				const n = this.tree.getNodeByPath(path);
				if (n) {
					n.isSelected = false;
					n._rev = (n._rev || 0) + 1;
				}
			}
		}
		// Then set isSelected on the new set.
		for (const path of next) {
			const n = this.tree.getNodeByPath(path);
			if (n && !n.isSelected) {
				n.isSelected = true;
				n._rev = (n._rev || 0) + 1;
			}
		}
		this.selectedPaths = next;
		this._notifySelectionChanged();
	}

	/** Clear isHighlighted flag on all currently highlighted nodes */
	private _clearAllHighlightFlags() {
		for (const path of this.highlightedPaths) {
			const n = this.tree.getNodeByPath(path);
			if (n) {
				n.isHighlighted = false;
				n._rev = (n._rev || 0) + 1;
			}
		}
	}

	/** Clear isSelected flag on all currently selected (checkbox) nodes */
	private _clearAllSelectionFlags() {
		for (const path of this.selectedPaths) {
			const n = this.tree.getNodeByPath(path);
			if (n) {
				n.isSelected = false;
				n._rev = (n._rev || 0) + 1;
			}
		}
	}

	/** Notify listeners about highlight change */
	private _notifyHighlightChanged() {
		if (this.onHighlightChangeHandler) {
			const nodes = this.getHighlightedNodes();
			this.onHighlightChangeHandler({ paths: this.highlightedPaths, nodes });
		}
	}

	/** Notify listeners about checkbox selection change */
	private _notifySelectionChanged() {
		if (this.onSelectionChangeHandler) {
			const nodes = this.getSelectedNodes();
			this.onSelectionChangeHandler({ paths: this.selectedPaths, nodes });
		}
	}

	/** Get nodes between two paths for range selection, respecting rangeSelectionMode */
	private _getNodesBetween(pathA: string, pathB: string): string[] {
		uiLogger.debug(`[multi-select] _getNodesBetween: ${pathA} → ${pathB}, mode=${this.rangeSelectionMode}`);
		if (this.rangeSelectionMode === 'logical') {
			return this._getAllNodesBetween(pathA, pathB);
		}
		return this._getVisibleNodesBetween(pathA, pathB);
	}

	/** Get visible nodes between two paths (inclusive), in display order.
	 *  Only includes expanded/visible nodes. */
	private _getVisibleNodesBetween(pathA: string, pathB: string): string[] {
		const flatNodes = this.tree.visibleFlatNodes;
		let indexA = -1;
		let indexB = -1;
		for (let i = 0; i < flatNodes.length; i++) {
			if (flatNodes[i].path === pathA) indexA = i;
			if (flatNodes[i].path === pathB) indexB = i;
			if (indexA !== -1 && indexB !== -1) break;
		}
		uiLogger.debug(`[multi-select] _getVisibleNodesBetween: indexA=${indexA}, indexB=${indexB}, totalVisible=${flatNodes.length}`);
		if (indexA === -1 || indexB === -1) {
			uiLogger.debug(`[multi-select] _getVisibleNodesBetween: path not found in visible nodes, falling back to [${pathB}]`);
			return [pathB];
		}
		const start = Math.min(indexA, indexB);
		const end = Math.max(indexA, indexB);
		const result = flatNodes.slice(start, end + 1).map(n => n.path);
		uiLogger.debug(`[multi-select] _getVisibleNodesBetween: selected ${result.length} visible nodes [${start}..${end}]`);
		return result;
	}

	/** Get ALL nodes between two paths (inclusive), in depth-first tree order.
	 *  Includes collapsed/hidden nodes — "logical" range selection. */
	private _getAllNodesBetween(pathA: string, pathB: string): string[] {
		// Walk entire tree depth-first and collect paths between A and B
		const allPaths: string[] = [];
		const traverse = (node: LTreeNode<T>) => {
			if (node.path) allPaths.push(node.path);
			for (const child of Object.values(node.children)) {
				traverse(child);
			}
		};
		for (const rootChild of this.tree.tree) {
			traverse(rootChild);
		}

		let indexA = -1;
		let indexB = -1;
		for (let i = 0; i < allPaths.length; i++) {
			if (allPaths[i] === pathA) indexA = i;
			if (allPaths[i] === pathB) indexB = i;
			if (indexA !== -1 && indexB !== -1) break;
		}
		uiLogger.debug(`[multi-select] _getAllNodesBetween: indexA=${indexA}, indexB=${indexB}, totalNodes=${allPaths.length}`);
		if (indexA === -1 || indexB === -1) {
			uiLogger.debug(`[multi-select] _getAllNodesBetween: path not found in tree, falling back to [${pathB}]`);
			return [pathB];
		}
		const start = Math.min(indexA, indexB);
		const end = Math.max(indexA, indexB);
		const result = allPaths.slice(start, end + 1);
		uiLogger.debug(`[multi-select] _getAllNodesBetween: selected ${result.length} nodes [${start}..${end}]`);
		return result;
	}

	// ── Public highlight methods (UI selection) ────────────────────────

	/** Highlight a single node. `mode` mirrors the click gestures:
	 *  'replace' (plain click) replaces the set, 'toggle' (Ctrl+click) adds/removes
	 *  just this node, 'range' (Shift+click) highlights from the shift-cursor to here.
	 *  Pass `{ silent: true }` to update state without firing `onNodeClick` / `onHighlightChange`. */
	highlightNode(path: string, mode: HighlightMode = 'replace', options?: TreeMutationOptions) {
		const node = this.tree.getNodeByPath(path);
		if (!node) return;

		if (mode === 'toggle') {
			this._onNodeClicked(node, { ctrl: true, shift: false }, { ...options, forceMultiSemantics: true });
		} else if (mode === 'range') {
			this._onNodeClicked(node, { ctrl: false, shift: true }, { ...options, forceMultiSemantics: true });
		} else {
			this._onNodeClicked(node, undefined, options);
		}
	}

	/** Add nodes to the highlight set (additive — existing highlights are kept).
	 *  Use setHighlightedPaths() to replace the whole set instead.
	 *  Pass `{ silent: true }` to skip `onHighlightChange`. */
	highlightNodes(paths: string[], options?: TreeMutationOptions) {
		const newPaths = new Set(this.highlightedPaths);
		let lastNode: LTreeNode<T> | null = null;
		for (const path of paths) {
			const node = this.tree.getNodeByPath(path);
			if (node && node.isSelectable) {
				node.isHighlighted = true;
				node._rev = (node._rev || 0) + 1;
				newPaths.add(path);
				lastNode = node;
			}
		}
		this.highlightedPaths = newPaths;
		if (lastNode) {
			this._setFocusedNode(lastNode);
			this._shiftCursor = lastNode.path;
		}
		if (!options?.silent) {
			this._notifyHighlightChanged();
			this._mirrorHighlightToSelected();
		}
		this.tree.refresh();
	}

	/** Replace the entire highlight set with the given paths.
	 *  Equivalent to clearHighlight() + highlightNodes(paths).
	 *  Pass `{ silent: true }` to skip `onHighlightChange`. */
	setHighlightedPaths(paths: string[], options?: TreeMutationOptions) {
		this._clearAllHighlightFlags();
		this.highlightedPaths = new Set();
		this._shiftCursor = null;
		this.highlightNodes(paths, { silent: true });
		if (!options?.silent) {
			this._notifyHighlightChanged();
			this._mirrorHighlightToSelected();
		}
		this.tree.refresh();
	}

	/** Highlight every visible node. Pass `{ silent: true }` to skip `onHighlightChange`. */
	highlightAll(options?: TreeMutationOptions) {
		this._clearAllHighlightFlags();
		const newPaths = new Set<string>();
		let lastNode: LTreeNode<T> | null = null;
		for (const node of this.tree.visibleFlatNodes) {
			if (!node.isSelectable) continue;
			node.isHighlighted = true;
			node._rev = (node._rev || 0) + 1;
			newPaths.add(node.path);
			lastNode = node;
		}
		this.highlightedPaths = newPaths;
		if (lastNode) {
			this._setFocusedNode(lastNode);
			this._shiftCursor = lastNode.path;
		}
		if (!options?.silent) {
			this._notifyHighlightChanged();
			this._mirrorHighlightToSelected();
		}
		this.tree.refresh();
	}

	/** Clear highlights. Pass `paths` to clear only those nodes, or omit to clear all.
	 *  Pass `{ silent: true }` to skip `onHighlightChange`. */
	clearHighlight(paths?: string[], options?: TreeMutationOptions) {
		if (paths && paths.length > 0) {
			const newPaths = new Set(this.highlightedPaths);
			for (const path of paths) {
				const n = this.tree.getNodeByPath(path);
				if (n) {
					n.isHighlighted = false;
					n._rev = (n._rev || 0) + 1;
				}
				newPaths.delete(path);
			}
			this.highlightedPaths = newPaths;
			if (this._shiftCursor && !newPaths.has(this._shiftCursor)) this._shiftCursor = null;
		} else {
			this._clearAllHighlightFlags();
			this.highlightedPaths = new Set();
			this._shiftCursor = null;
		}
		if (!options?.silent) {
			this._notifyHighlightChanged();
			this._mirrorHighlightToSelected();
		}
		this.tree.refresh();
	}

	/** Get all highlighted nodes */
	getHighlightedNodes(): LTreeNode<T>[] {
		const nodes: LTreeNode<T>[] = [];
		for (const path of this.highlightedPaths) {
			const node = this.tree.getNodeByPath(path);
			if (node) nodes.push(node);
		}
		return nodes;
	}

	/** Check if a specific node path is highlighted */
	isNodeHighlighted(path: string): boolean {
		return this.highlightedPaths.has(path);
	}

	/** Toggle the focused node in/out of the highlight set. Multi-mode only. */
	toggleFocusedHighlight(): void {
		if (this.selectionMode !== 'multi') return;
		const node = this.focusedNode;
		if (!node || !node.isSelectable) return;
		this._onNodeClicked(node, { ctrl: true, shift: false }, { forceMultiSemantics: true });
	}

	// ── Public selection methods (checkbox data state) ───────────────

	/** Get all selected (checked) nodes */
	getSelectedNodes(): LTreeNode<T>[] {
		const nodes: LTreeNode<T>[] = [];
		for (const path of this.selectedPaths) {
			const node = this.tree.getNodeByPath(path);
			if (node) nodes.push(node);
		}
		return nodes;
	}

	/** Check if a specific node path is selected (checked) */
	isNodeSelected(path: string): boolean {
		return this.selectedPaths.has(path);
	}

	/** Apply a checked/unchecked state to the given paths, expanding to descendants
	 *  in cascade mode and recomputing ancestor visual states. Returns whether the
	 *  selected set actually changed. Does not notify or refresh — callers do that. */
	private _applyCheckboxState(paths: string[], checked: boolean): boolean {
		let affected = paths;
		if (this.checkboxMode === 'cascade') {
			const expanded = new Set(paths);
			for (const path of paths) {
				const n = this.tree.getNodeByPath(path);
				if (n) for (const dp of this._getDescendantPaths(n)) expanded.add(dp);
			}
			affected = [...expanded];
		}
		const newPaths = new Set(this.selectedPaths);
		let changed = false;
		for (const path of affected) {
			const n = this.tree.getNodeByPath(path);
			if (!n) continue;
			if (checked) {
				if (!newPaths.has(path)) { newPaths.add(path); changed = true; }
				n.isSelected = true;
			} else {
				if (newPaths.has(path)) { newPaths.delete(path); changed = true; }
				n.isSelected = false;
			}
			n._rev = (n._rev || 0) + 1;
		}
		this.selectedPaths = newPaths;
		if (this.checkboxMode === 'cascade') {
			for (const rp of paths) {
				const rn = this.tree.getNodeByPath(rp);
				if (!rn) continue;
				const vs = this._computeVisualState(rn);
				if (rn.visualState !== vs) { rn.visualState = vs; rn._rev = (rn._rev || 0) + 1; }
				this._updateAncestorVisualStates(rp);
			}
		}
		return changed;
	}

	/** Check a single node (cascades to descendants in cascade mode).
	 *  Pass `{ silent: true }` to skip `onSelectionChange`. */
	selectNode(path: string, options?: TreeMutationOptions) {
		const changed = this._applyCheckboxState([path], true);
		if (changed && !options?.silent) this._notifySelectionChanged();
		this.tree.refresh();
	}

	/** Check multiple nodes (additive — existing checks are kept).
	 *  Use setSelectedPaths() to replace the whole set instead.
	 *  Pass `{ silent: true }` to skip `onSelectionChange`. */
	selectNodes(paths: string[], options?: TreeMutationOptions) {
		const changed = this._applyCheckboxState(paths, true);
		if (changed && !options?.silent) this._notifySelectionChanged();
		this.tree.refresh();
	}

	/** Replace the entire checkbox set with the given paths.
	 *  Equivalent to clearSelection() + selectNodes(paths).
	 *  Pass `{ silent: true }` to skip `onSelectionChange`. */
	setSelectedPaths(paths: string[], options?: TreeMutationOptions) {
		this._clearAllSelectionFlags();
		this.selectedPaths = new Set();
		this._applyCheckboxState(paths, true);
		if (!options?.silent) this._notifySelectionChanged();
		this.tree.refresh();
	}

	/** Check every selectable node. Pass `{ silent: true }` to skip `onSelectionChange`. */
	selectAll(options?: TreeMutationOptions) {
		const newPaths = new Set<string>();
		const traverse = (node: LTreeNode<T>) => {
			if (node.path && node.isSelectable) {
				node.isSelected = true;
				if (node.visualState !== VisualState.selected) node.visualState = VisualState.selected;
				node._rev = (node._rev || 0) + 1;
				newPaths.add(node.path);
			}
			for (const child of Object.values(node.children)) traverse(child);
		};
		for (const root of this.tree.tree) traverse(root);
		this.selectedPaths = newPaths;
		if (!options?.silent) this._notifySelectionChanged();
		this.tree.refresh();
	}

	/** Uncheck a single node (cascades to descendants in cascade mode).
	 *  Pass `{ silent: true }` to skip `onSelectionChange`. */
	deselectNode(path: string, options?: TreeMutationOptions) {
		const changed = this._applyCheckboxState([path], false);
		if (changed && !options?.silent) this._notifySelectionChanged();
		this.tree.refresh();
	}

	/** Clear checkbox selection. Pass `paths` to uncheck only those nodes, or omit to clear all.
	 *  Pass `{ silent: true }` to skip `onSelectionChange`. */
	clearSelection(paths?: string[], options?: TreeMutationOptions) {
		if (paths && paths.length > 0) {
			const changed = this._applyCheckboxState(paths, false);
			if (changed && !options?.silent) this._notifySelectionChanged();
			this.tree.refresh();
			return;
		}
		this._clearAllSelectionFlags();
		this.selectedPaths = new Set();
		if (!options?.silent) this._notifySelectionChanged();
		this.tree.refresh();
	}

	// ── Public focus methods (single cursor) ─────────────────────────

	/** Move focus to a node. `_options` is accepted for signature parity;
	 *  focus changes have no dedicated change callback. */
	focusNode(path: string, _options?: TreeMutationOptions) {
		const node = this.tree.getNodeByPath(path);
		if (!node) return;
		this._setFocusedNode(node);
		this.tree.refresh();
	}

	/** Clear the focused node. */
	clearFocus(_options?: TreeMutationOptions) {
		this._setFocusedNode(null);
		this.tree.refresh();
	}

	private _onNodeRightClicked(node: LTreeNode<T>, event: MouseEvent) {
		if (!this.hasContextMenuSnippet && !this.getContextMenuItemsHandler) {
			return;
		}

		// Decision 12: right-click does NOT move focus or highlight. It only opens
		// the context menu at the right-clicked node. If the consumer needs the
		// menu to act on something other than the highlight set, they can read
		// the node passed to their getContextMenuItemsCallback.
		uiLogger.debug(`Context menu opened: ${node.path}`);
		event.preventDefault();
		this.openContextMenu(node, event.clientX, event.clientY);
	}

	// ── Drag and drop ───────────────────────────────────────────────────

	private isDropAllowedByMode(draggedNodeTreeId: string | undefined): boolean {
		if (this.dragDropMode === 'none') return false;
		const isSameTree = draggedNodeTreeId === this.treeId;
		if (this.dragDropMode === 'self' && !isSameTree) return false;
		if (this.dragDropMode === 'cross' && isSameTree) return false;
		return true;
	}

	private calculateDropPosition(
		event: DragEvent | MouseEvent,
		element: Element
	): DropPosition {
		const rect = element.getBoundingClientRect();
		const y = event.clientY - rect.top;
		const height = rect.height;
		if (y < height * 0.25) return 'before';
		if (y > height * 0.75) return 'after';
		return 'child';
	}

	private _onNodeDragStart(node: LTreeNode<T>, event: DragEvent) {
		dragLogger.debug(`Drag started: ${node.path}`, {
			ctrlKey: event.ctrlKey,
			isCopyAllowed: this.isCopyAllowed,
			treeId: this.treeId
		});
		dragLogger.debug('[drag-esc] _onNodeDragStart', {
			path: node.path,
			isSelectable: node.isSelectable,
			alreadyHighlighted: this.highlightedPaths.has(node.path),
			highlightedPathsBefore: Array.from(this.highlightedPaths)
		});

		this.draggedNode = node;
		this.isDragInProgress = true;
		// Publish the top-level set so a CROSS-TREE drop can expose it via ctx.dragged
		// (the target controller can't see this tree's highlight set).
		const draggedRefs = this._draggedRefs(node);
		setDragSet(this.treeId, draggedRefs.map((r) => r.path));
		this.onNodeDragStartHandler?.({
			...this.nodeRef(node),
			event,
			dragged: draggedRefs
		});

		// The container-level `ondragend` listener on `.stv__container` misses
		// the cancellation path when the rAF below calls `tree.refresh()`: the
		// refresh detaches the source row, so the subsequent `dragend` (on the
		// detached element) has no DOM ancestors to bubble through and never
		// reaches the container. Attach the listener directly on the source
		// element — direct-element listeners still fire after detachment.
		const srcEl = event.currentTarget as HTMLElement | null;
		if (srcEl) {
			const onEnd = (e: DragEvent) => {
				srcEl.removeEventListener('dragend', onEnd);
				dragLogger.debug('[drag-esc] direct dragend listener fired on source');
				this._onNodeDragEnd(e);
			};
			srcEl.addEventListener('dragend', onEnd);
		}

		// OS-convention selection sync: if the user grabs a node that isn't part
		// of the current highlight set, replace the highlight with just that node.
		// Mirrors Windows Explorer / macOS Finder where mousedown on an unselected
		// item selects it. Without this, the prior highlight stayed visible while
		// the drag silently carried only the single grabbed node — confusing the
		// user about what's moving. Deferred to rAF (not microtask): microtasks
		// drain before the browser commits the drag image, so mutating the source
		// row's DOM there causes `tree.refresh()` to re-create the dragged element
		// and the browser silently aborts the drag (no dragend fires). rAF runs as
		// part of the rendering steps, after the drag is committed. Drop handlers
		// fire well after this rAF, so they read the updated `highlightedPaths`.
		// Skipped when the node is already in the set (multi-drag) or not
		// selectable (preserves prior highlight state for unselectable rows).
		if (node.isSelectable && !this.highlightedPaths.has(node.path)) {
			dragLogger.debug('[drag-esc] scheduling rAF selection sync');
			requestAnimationFrame(() => {
				// Esc-cancel can fire dragend before this rAF runs, leaving the source
				// node "stuck" highlighted after a cancelled drag. Bail if the drag is
				// no longer in progress.
				dragLogger.debug('[drag-esc] rAF fired', {
					isDragInProgress: this.isDragInProgress,
					currentHighlight: Array.from(this.highlightedPaths)
				});
				if (!this.isDragInProgress) return;
				// Snapshot the prior highlight so _onNodeDragEnd can restore it if
				// the drag is Esc-cancelled. Without this, the user is left with the
				// dragged node selected even though they cancelled the operation.
				this._preDragHighlightSnapshot = new Set(this.highlightedPaths);
				dragLogger.debug('[drag-esc] snapshot captured', Array.from(this._preDragHighlightSnapshot));
				this._clearAllHighlightFlags();
				node.isHighlighted = true;
				node._rev = (node._rev || 0) + 1;
				this.highlightedPaths = new Set([node.path]);
				this._shiftCursor = node.path;
				this._notifyHighlightChanged();
				this._mirrorHighlightToSelected();
				this.tree.refresh();
			});
		} else {
			dragLogger.debug('[drag-esc] rAF NOT scheduled', {
				isSelectable: node.isSelectable,
				alreadyHighlighted: this.highlightedPaths.has(node.path)
			});
		}
	}

	_onNodeDragEnd = (event: DragEvent) => {
		const dropEffect = event.dataTransfer?.dropEffect;
		dragLogger.debug('Drag ended', {
			dropEffect,
			operation: this.currentDropOperation
		});
		dragLogger.debug('[drag-esc] _onNodeDragEnd', {
			dropEffect,
			operation: this.currentDropOperation,
			snapshot: this._preDragHighlightSnapshot ? Array.from(this._preDragHighlightSnapshot) : null,
			currentHighlight: Array.from(this.highlightedPaths),
			willRestore: dropEffect === 'none' && !!this._preDragHighlightSnapshot
		});
		// Esc-cancel / drop-on-invalid-target: restore the pre-drag highlight
		// so the dragged node doesn't end up "stuck" selected.
		if (dropEffect === 'none' && this._preDragHighlightSnapshot) {
			const prior = this._preDragHighlightSnapshot;
			dragLogger.debug('[drag-esc] restoring highlight to', Array.from(prior));
			this._clearAllHighlightFlags();
			this.highlightedPaths = new Set(prior);
			for (const path of prior) {
				const n = this.tree.getNodeByPath(path);
				if (n) {
					n.isHighlighted = true;
					n._rev = (n._rev || 0) + 1;
				}
			}
			this._notifyHighlightChanged();
			this._mirrorHighlightToSelected();
			this.tree.refresh();
			dragLogger.debug('[drag-esc] restore complete', { highlightedPathsAfter: Array.from(this.highlightedPaths) });
		}
		this._preDragHighlightSnapshot = null;
		this._resetDragState();
	};

	private _resetDragState(): void {
		dragLogger.debug('_resetDragState');
		clearDragSet();
		this.isDragInProgress = false;
		this.draggedNode = null;
		this.hoveredNodeForDrop = null;
		this.activeDropPosition = null;
		this.isDropPlaceholderActive = false;
		this.currentDropOperation = 'move';
		this.floatingZoneRect = null;
		this.floatingHoveredZone = null;
	}

	private async _handleDrop(
		dropNode: LTreeNode<T> | null,
		draggedNodeRef: LTreeNode<T>,
		position: DropPosition,
		event: DragEvent | TouchEvent
	): Promise<boolean> {
		let operation: DropOperation = 'move';
		const isDragEvent = event instanceof DragEvent;
		const ctrlKey = isDragEvent ? event.ctrlKey : false;

		if (this.isCopyAllowed && isDragEvent && ctrlKey) {
			operation = 'copy';
		}

		dragLogger.info(`Drop: ${draggedNodeRef.path} -> ${dropNode?.path ?? 'empty tree'}`, {
			position,
			operation,
			isCrossTree: draggedNodeRef.treeId !== this.treeId
		});

		if (this.beforeDropHandler) {
			const result = await this.beforeDropHandler(
				dropNode,
				draggedNodeRef,
				position,
				event,
				operation
			);
			if (result === false) return false;
			if (result && typeof result === 'object') {
				if ('position' in result && result.position) position = result.position;
				if ('operation' in result && result.operation) operation = result.operation;
			}
		}

		const isSameTreeDrag = draggedNodeRef.treeId === this.treeId;

		// Capture the full dragged set BEFORE any move mutates the highlight set, so the
		// event's `dragged` reflects what the user picked up (not the post-move remap).
		// _draggedRefs is cross-tree-aware: same-tree resolves live nodes, cross-tree pulls
		// the top-level paths the source published on drag start (getDragSet).
		const draggedRefs = this._draggedRefs(draggedNodeRef);
		// One fire path for every branch: `dropped` = the nodes the library actually placed
		// (null when it didn't — cross-tree or shouldAutoHandle*=false). NodeRefs are built
		// at fire time so parent/siblings reflect the final tree.
		const fireDrop = (dropped: LTreeNode<T>[] | null) => {
			this.onNodeDropHandler?.({
				source: this.nodeRef(draggedNodeRef),
				target: dropNode ? this.nodeRef(dropNode) : null,
				dragged: draggedRefs,
				dropped: dropped ? dropped.map((n) => this.nodeRef(n)) : null,
				position,
				operation,
				event
			});
		};

		// Multi-drag (Decision 6 in selection-highlight-model.md):
		// When the dragged node is part of a multi-highlight, move the whole highlight
		// set as top-level-selected subtrees. Descendants whose nearest highlighted
		// ancestor is in the set are absorbed (ride along inside the subtree).
		const isMultiDrag =
			isSameTreeDrag &&
			operation === 'move' &&
			dropNode &&
			this.shouldAutoHandleMove &&
			this.highlightedPaths.has(draggedNodeRef.path) &&
			this.highlightedPaths.size > 1;

		if (isMultiDrag) {
			const topLevelPaths = this._getTopLevelHighlightedPaths()
				// drop target can't be moved onto itself
				.filter((p) => p !== dropNode!.path)
				// Respect per-node draggability: a locked node (isDraggable=false) that
				// merely happens to be in the highlight set must NOT ride along. The
				// single-drag path is already gated at drag *start*, but multi-drag
				// pulls straight from highlightedPaths, so it has to re-check here.
				.filter((p) => {
					const n = this.tree.getNodeByPath(p);
					return n ? this.getNodeIsDraggable(n) : false;
				});
			dragLogger.info(`Multi-drag: moving ${topLevelPaths.length} top-level subtree(s)`, {
				topLevelPaths,
				totalHighlighted: this.highlightedPaths.size,
				dropTarget: dropNode!.path,
				position
			});
			let allOk = true;
			// First top-level node uses the requested position relative to dropNode.
			// Subsequent ones chain 'after' the previously moved node so the whole
			// set lands as siblings in source order: dropping A,B,C 'after D' yields
			// [D, A, B, C]; 'before D' yields [A, B, C, D]; 'child of D' yields D's
			// children = [A, B, C]. moveNode mutates the source LTreeNode in place,
			// so reading the held reference's .path post-move gives the new path.
			let prevMovedNode: LTreeNode<T> | null = null;
			const movedNodes: LTreeNode<T>[] = [];
			for (let i = 0; i < topLevelPaths.length; i++) {
				const sourcePath = topLevelPaths[i];
				const targetPath = i === 0 ? dropNode!.path : prevMovedNode!.path;
				const pos: DropPosition = i === 0 ? position : 'after';
				const sourceNode = this.tree.getNodeByPath(sourcePath);
				const r = this.moveNode(sourcePath, targetPath, pos);
				if (!r.success) {
					allOk = false;
				} else if (sourceNode) {
					prevMovedNode = sourceNode;
					movedNodes.push(sourceNode);
				}
			}
			fireDrop(movedNodes);
			return allOk;
		}

		if (isSameTreeDrag && operation === 'move' && dropNode) {
			if (this.shouldAutoHandleMove) {
				const result = this.moveNode(draggedNodeRef.path, dropNode.path, position);
				// moveNode mutates in place, so draggedNodeRef IS the landed node.
				fireDrop([draggedNodeRef]);
				return result.success;
			}
			// shouldAutoHandleMove=false: library placed nothing → dropped is null.
			fireDrop(null);
			return true;
		}

		if (isSameTreeDrag && operation === 'copy' && dropNode && this.shouldAutoHandleCopy) {
			const targetParentPath =
				position === 'child' ? dropNode.path : dropNode.parentPath || '';
			const siblingPath = position !== 'child' ? dropNode.path : undefined;
			const copyPosition = position !== 'child' ? position : undefined;

			const result = this.tree.copyNodeWithDescendants(
				draggedNodeRef,
				targetParentPath,
				(data) => ({
					...data,
					[this.tree.idMember || 'id']: `${(data as any)[this.tree.idMember || 'id']}_copy_${Date.now()}`
				}),
				siblingPath,
				copyPosition
			);
			// The fresh copy's root is the landed node (distinct from the dragged original).
			fireDrop(result.rootNode ? [result.rootNode] : null);
			return result.success;
		}

		// Cross-tree, or copy without shouldAutoHandleCopy: the consumer performs the
		// insertion, so the library placed nothing → dropped is null.
		fireDrop(null);
		return true;
	}

	private _onNodeDragOver(node: LTreeNode<T>, event: DragEvent) {
		let effectiveDraggedNode = this.draggedNode;
		let isCrossTreeDrag = false;
		if (
			!effectiveDraggedNode &&
			event.dataTransfer?.types.includes('application/svelte-treeview')
		) {
			isCrossTreeDrag = true;
			try {
				const data = event.dataTransfer.getData('application/svelte-treeview');
				if (data) {
					effectiveDraggedNode = JSON.parse(data);
				}
			} catch {
				// getData might fail during dragover in some browsers
			}
			this.isDragInProgress = true;
		}

		const dropAllowed = isCrossTreeDrag
			? this.dragDropMode === 'both' || this.dragDropMode === 'cross'
			: this.isDropAllowedByMode(effectiveDraggedNode?.treeId);

		if (!dropAllowed) {
			this.hoveredNodeForDrop = null;
			return;
		}

		// Per-node opt-out gate. Mirrors the touch path so isDropAllowed:false
		// rejects drops on desktop too (without this the desktop drop fires
		// unconditionally and the prop only affected touch).
		if (!node.isDropAllowed) {
			this.hoveredNodeForDrop = null;
			return;
		}

		const isValidDrop = effectiveDraggedNode
			? isCrossTreeDrag || effectiveDraggedNode.path !== node.path
			: this.isDragInProgress;

		if (isValidDrop) {
			event.preventDefault();
			this.hoveredNodeForDrop = node;
			const nodeElement = (event.target as Element).closest('.stv__node-content');
			if (nodeElement) {
				this.activeDropPosition = this.calculateDropPosition(event, nodeElement);
			}
			this.currentDropOperation = this.isCopyAllowed && event.ctrlKey ? 'copy' : 'move';
			this.onNodeDragOverHandler?.({
				...this.nodeRef(node),
				event,
				dragged: this._draggedRefs(this.draggedNode)
			});

			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = this.currentDropOperation;
			}

			// Capture node rect for floating drop zones (rendered at Tree level with position:fixed)
			if (this.dropZoneMode === 'floating') {
				const nodeRow = (event.target as Element).closest('.stv__node-row');
				if (nodeRow) {
					const r = nodeRow.getBoundingClientRect();
					this.floatingZoneRect = { top: r.top, left: r.left, width: r.width, height: r.height };
				}
			}
		}
	}

	private _onNodeDragLeave(_node: LTreeNode<T>, _event: DragEvent) {
		// Don't clear hoveredNodeForDrop — let dragover on other nodes handle it
	}

	private _onNodeDrop(node: LTreeNode<T>, event: DragEvent) {
		event.preventDefault();

		let isCrossTreeDrag = false;
		if (!this.draggedNode) {
			const data = event.dataTransfer?.getData('application/svelte-treeview');
			if (data) {
				this.draggedNode = JSON.parse(data);
				isCrossTreeDrag = this.draggedNode?.treeId !== this.treeId;
			}
		}

		const dropAllowed = isCrossTreeDrag
			? this.dragDropMode === 'both' || this.dragDropMode === 'cross'
			: this.isDropAllowedByMode(this.draggedNode?.treeId);

		if (!dropAllowed) {
			this._onNodeDragEnd(event);
			return;
		}

		// Per-node opt-out gate. The dragover gate also enforces this for
		// custom renderers using the public dragOver() API, but the Node.svelte
		// component calls event.preventDefault() itself before forwarding to
		// the controller — so the drop event fires anyway and must be filtered
		// here. Mirrors the touch path at line ~3110.
		if (!node.isDropAllowed) {
			this._onNodeDragEnd(event);
			return;
		}

		if (this.draggedNode && (isCrossTreeDrag || this.draggedNode !== node)) {
			const position = this.activeDropPosition || 'child';
			this._handleDrop(node, this.draggedNode, position, event);
		}

		this._onNodeDragEnd(event);
	}

	private _onZoneDrop(node: LTreeNode<T>, position: DropPosition, event: DragEvent) {
		event.preventDefault();

		let isCrossTreeDrag = false;
		if (!this.draggedNode) {
			const data = event.dataTransfer?.getData('application/svelte-treeview');
			if (data) {
				this.draggedNode = JSON.parse(data);
				isCrossTreeDrag = this.draggedNode?.treeId !== this.treeId;
			}
		}

		if (!this.draggedNode) {
			this._onNodeDragEnd(event);
			return;
		}

		const dropAllowed = isCrossTreeDrag
			? this.dragDropMode === 'both' || this.dragDropMode === 'cross'
			: this.isDropAllowedByMode(this.draggedNode?.treeId);

		if (!dropAllowed) {
			this._onNodeDragEnd(event);
			return;
		}

		// Per-node opt-out gate (glow mode equivalent of the _onNodeDrop gate).
		if (!node.isDropAllowed) {
			this._onNodeDragEnd(event);
			return;
		}

		if (isCrossTreeDrag || this.draggedNode !== node) {
			this._handleDrop(node, this.draggedNode, position, event);
		}

		this._onNodeDragEnd(event);
	}

	// ── Floating drop zone handlers (Tree-level overlay) ────────────────

	isFloatingPositionAllowed(position: DropPosition): boolean {
		if (!this.hoveredNodeForDrop) return false;
		const allowed = this.tree.getNodeAllowedDropPositions(this.hoveredNodeForDrop);
		if (!allowed || allowed.length === 0) return true; // All positions allowed by default
		return allowed.includes(position);
	}

	handleFloatingZoneDragOver(position: 'before' | 'after' | 'child', event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = (this.isCopyAllowed && event.ctrlKey) ? 'copy' : 'move';
		}
		this.floatingHoveredZone = position;
		// Refresh rect from node row
		if (this.hoveredNodeForDrop) {
			this._onNodeDragOver(this.hoveredNodeForDrop, event);
		}
	}

	handleFloatingZoneDragLeave() {
		this.floatingHoveredZone = null;
	}

	handleFloatingZoneDrop(position: DropPosition, event: DragEvent) {
		this.floatingHoveredZone = null;
		if (this.hoveredNodeForDrop) {
			this._onZoneDrop(this.hoveredNodeForDrop, position, event);
		}
	}

	// ── Touch drag handlers ─────────────────────────────────────────────

	private _onTouchStart(node: LTreeNode<any>, event: TouchEvent) {
		if (!this.getNodeIsDraggable(node)) return;

		const touch = event.touches[0];
		this.touchDragState = {
			node,
			startX: touch.clientX,
			startY: touch.clientY,
			isDragging: false,
			ghostElement: null,
			currentDropTarget: null
		};

		// Attach document-level listeners with { passive: false } so we can
		// preventDefault on touchmove (Svelte's delegated handlers are passive
		// and cannot prevent scrolling).
		this._addDocumentTouchListeners();

		this.touchTimer = setTimeout(() => {
			this.touchDragState.isDragging = true;
			this.draggedNode = node;
			this.isDragInProgress = true;
			setDragSet(this.treeId, this._draggedRefs(node).map((r) => r.path));
			dragLogger.debug(`Touch drag started: ${node.path}`);
			this.createGhostElement(node, touch.clientX, touch.clientY);
			try { navigator.vibrate?.(50); } catch { /* blocked by browser policy */ }
		}, 300);
	}

	// The per-node Svelte handlers are kept as no-ops so the callbacks interface
	// stays intact, but all real work happens on document-level listeners.
	private _onTouchMove(_node: LTreeNode<any>, _event: TouchEvent) {
		// Handled by _docTouchMove
	}

	private _onTouchEnd(_node: LTreeNode<any>, _event: TouchEvent) {
		// Handled by _docTouchEnd
	}

	// ── Document-level touch listeners (non-passive) ─────────────────────

	private _boundDocTouchMove: ((e: TouchEvent) => void) | null = null;
	private _boundDocTouchEnd: ((e: TouchEvent) => void) | null = null;

	private _addDocumentTouchListeners() {
		this._removeDocumentTouchListeners();
		this._boundDocTouchMove = (e: TouchEvent) => this._docTouchMove(e);
		this._boundDocTouchEnd = (e: TouchEvent) => this._docTouchEnd(e);
		document.addEventListener('touchmove', this._boundDocTouchMove, { passive: false });
		document.addEventListener('touchend', this._boundDocTouchEnd);
		document.addEventListener('touchcancel', this._boundDocTouchEnd);
	}

	private _removeDocumentTouchListeners() {
		if (this._boundDocTouchMove) {
			document.removeEventListener('touchmove', this._boundDocTouchMove);
			this._boundDocTouchMove = null;
		}
		if (this._boundDocTouchEnd) {
			document.removeEventListener('touchend', this._boundDocTouchEnd);
			document.removeEventListener('touchcancel', this._boundDocTouchEnd);
			this._boundDocTouchEnd = null;
		}
	}

	private _docTouchMove(event: TouchEvent) {
		if (!this.touchDragState.node) return;

		const touch = event.touches[0];

		if (!this.touchDragState.isDragging) {
			const dx = Math.abs(touch.clientX - this.touchDragState.startX);
			const dy = Math.abs(touch.clientY - this.touchDragState.startY);
			if (dx > 10 || dy > 10) {
				if (this.touchTimer) clearTimeout(this.touchTimer);
				this._resetTouchState();
			}
			return;
		}

		// Non-passive listener: this actually prevents scrolling
		event.preventDefault();

		if (this.touchDragState.ghostElement) {
			this.touchDragState.ghostElement.style.left = `${touch.clientX}px`;
			this.touchDragState.ghostElement.style.top = `${touch.clientY}px`;
		}

		if (this.touchDragState.ghostElement) {
			this.touchDragState.ghostElement.style.pointerEvents = 'none';
		}
		const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
		if (this.touchDragState.ghostElement) {
			this.touchDragState.ghostElement.style.pointerEvents = '';
		}

		this.updateDropTarget(elementUnderTouch);
	}

	private _docTouchEnd(event: TouchEvent) {
		if (this.touchTimer) clearTimeout(this.touchTimer);

		if (this.touchDragState.isDragging && this.draggedNode) {
			const touch = event.changedTouches[0];

			if (this.touchDragState.ghostElement) {
				this.touchDragState.ghostElement.style.display = 'none';
			}

			const dropElement = document.elementFromPoint(touch.clientX, touch.clientY);
			const dropNode = this.findNodeFromElement(dropElement);

			const placeholder = dropElement?.closest('.stv__empty-state');
			const rootDropZone = dropElement?.closest('.stv__root-drop-zone');
			if ((placeholder || rootDropZone) && !dropNode) {
				dragLogger.debug(`Touch drag ended: ${this.draggedNode.path} -> empty tree`);
				this._handleDrop(null, this.draggedNode, 'child', event);
			} else if (dropNode && dropNode !== this.draggedNode && dropNode.isDropAllowed) {
				dragLogger.debug(
					`Touch drag ended: ${this.draggedNode.path} -> ${dropNode.path}`
				);
				this._handleDrop(dropNode, this.draggedNode, 'child', event);
			} else {
				dragLogger.debug(`Touch drag cancelled: ${this.draggedNode.path}`);
			}

			this.removeGhostElement();
			this.clearDropTargetHighlight();
		}

		this._resetTouchState();
	}

	private _resetTouchState() {
		this._removeDocumentTouchListeners();
		this.touchDragState = {
			node: null,
			startX: 0,
			startY: 0,
			isDragging: false,
			ghostElement: null,
			currentDropTarget: null
		};
		this.draggedNode = null;
		this.isDragInProgress = false;
		this.isDropPlaceholderActive = false;
		clearDragSet();
	}

	private createGhostElement(node: LTreeNode<any>, x: number, y: number) {
		// Remove any stale ghost elements (e.g. from interrupted drags)
		this.removeGhostElement();
		document.querySelectorAll('.stv__touch-ghost').forEach(el => el.remove());

		const ghost = document.createElement('div');
		ghost.className = 'stv__touch-ghost';
		ghost.textContent = this.tree.getNodeDisplayValue(node);
		ghost.style.left = `${x}px`;
		ghost.style.top = `${y}px`;
		document.body.appendChild(ghost);
		this.touchDragState.ghostElement = ghost;
	}

	private removeGhostElement() {
		if (this.touchDragState.ghostElement) {
			this.touchDragState.ghostElement.remove();
			this.touchDragState.ghostElement = null;
		}
	}

	/** Clean up document-level listeners and ghost elements. Called on component destroy. */
	destroy() {
		unregisterClipboardTree(this.treeId, this);
		if (typeof document === 'undefined') return;
		this._removeDocumentTouchListeners();
		this.removeGhostElement();
		// Remove any orphaned ghosts from document body
		document.querySelectorAll('.stv__touch-ghost').forEach(el => el.remove());
	}

	private findNodeFromElement(element: Element | null): LTreeNode<any> | null {
		if (!element) return null;
		const nodeElement = element.closest('.stv__node');
		if (!nodeElement) return null;
		const path = nodeElement.getAttribute('data-tree-path');
		if (!path) return null;
		return this.tree.getNodeByPath(path);
	}

	private updateDropTarget(element: Element | null) {
		const newTarget = this.findNodeFromElement(element);

		if (this.touchDragState.currentDropTarget && this.touchDragState.currentDropTarget !== newTarget) {
			const prevElement = document.querySelector(
				`[data-tree-path="${this.touchDragState.currentDropTarget.path}"] .stv__node-content`
			);
			prevElement?.classList.remove(this.dragOverNodeClass || 'stv__node-content--dragover-highlight');
		}

		const placeholder = element?.closest('.stv__empty-state');
		if (placeholder && !newTarget) {
			this.isDropPlaceholderActive = true;
			this.touchDragState.currentDropTarget = null;
			return;
		} else {
			this.isDropPlaceholderActive = false;
		}

		if (newTarget && newTarget !== this.draggedNode && newTarget.isDropAllowed) {
			const targetElement = document.querySelector(
				`[data-tree-path="${newTarget.path}"] .stv__node-content`
			);
			targetElement?.classList.add(this.dragOverNodeClass || 'stv__node-content--dragover-highlight');
			this.touchDragState.currentDropTarget = newTarget;
		} else {
			this.touchDragState.currentDropTarget = null;
		}
	}

	private clearDropTargetHighlight() {
		if (this.touchDragState.currentDropTarget) {
			const element = document.querySelector(
				`[data-tree-path="${this.touchDragState.currentDropTarget.path}"] .stv__node-content`
			);
			element?.classList.remove(this.dragOverNodeClass || 'stv__node-content--dragover-highlight');
		}
	}

	// ── Empty tree drop handlers (used directly in template) ────────────

	handleEmptyTreeDragOver = (event: DragEvent) => {
		if (this.dragDropMode === 'none') return;
		if (event.dataTransfer?.types.includes('application/svelte-treeview')) {
			event.preventDefault();
			this.isDropPlaceholderActive = true;
			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = 'move';
			}
		}
	};

	handleEmptyTreeDragLeave = (event: DragEvent) => {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = event.clientX;
		const y = event.clientY;
		if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
			this.isDropPlaceholderActive = false;
		}
	};

	handleEmptyTreeDrop = (event: DragEvent) => {
		event.preventDefault();
		this.isDropPlaceholderActive = false;
		if (this.dragDropMode === 'none') return;

		const draggedNodeData = event.dataTransfer?.getData('application/svelte-treeview');
		if (draggedNodeData) {
			const droppedNode = JSON.parse(draggedNodeData);
			this._handleDrop(null, droppedNode, 'child', event);
		}
		this._onNodeDragEnd(event);
	};

	handleEmptyTreeTouchEnd = (event: TouchEvent) => {
		if (this.dragDropMode === 'none') return;
		if (this.draggedNode && this.isDropPlaceholderActive) {
			this._handleDrop(null, this.draggedNode, 'child', event);
			this.isDropPlaceholderActive = false;
		}
	};

	// ── Tree-level drag handlers (used directly in template) ────────────

	handleTreeDragEnter = (event: DragEvent) => {
		if (event.dataTransfer?.types.includes('application/svelte-treeview')) {
			this.isDragInProgress = true;
		}
	};

	handleTreeDragLeave = (event: DragEvent) => {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = event.clientX;
		const y = event.clientY;
		if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
			if (this.draggedNode?.treeId !== this.treeId) {
				this.isDragInProgress = false;
				this.hoveredNodeForDrop = null;
				this.activeDropPosition = null;
			}
		}
	};

	// ── Helpers ──────────────────────────────────────────────────────────

	scheduleFlatRenderBatch() {
		if (this.flatRenderAnimationFrame) return;

		this.flatRenderAnimationFrame = requestAnimationFrame(() => {
			this.flatRenderAnimationFrame = null;
			if (this.flatRenderQueue.length === 0) return;

			const batchSize = this.currentBatchSize || this.initialBatchSize;
			const batch = this.flatRenderQueue.slice(0, batchSize);
			const remaining = this.flatRenderQueue.slice(batchSize);

			this.flatRenderedIds = new Set([...this.flatRenderedIds, ...batch]);
			this.flatRenderQueue = remaining;
			this.currentBatchSize = Math.min(batchSize * 2, this.maxBatchSize);

			if (remaining.length > 0) {
				this.scheduleFlatRenderBatch();
			}
		});
	}

	private generateTreeId(): string {
		return `${Date.now()}${Math.floor(Math.random() * 10000)}`;
	}

	// ── Keyboard navigation (delegates to this.navigation strategy) ─────

	/** Select a node and scroll it into view (core navigation primitive) */
	navTo(path: string): void { this.navigation.navTo(path); }
	/** Move to next visible node at the same level */
	navNextSibling(): void { this.navigation.navNextSibling(); }
	/** Move to previous visible node at the same level */
	navPrevSibling(): void { this.navigation.navPrevSibling(); }
	/** Move to first child (expands if collapsed) */
	navInto(): void { this.navigation.navInto(); }
	/** Move to parent node (no collapse) */
	navOut(): void { this.navigation.navOut(); }
	/** Collapse parent and select it (Backspace behavior) */
	navBackOut(): void { this.navigation.navBackOut(); }
	/** Toggle expand/collapse of current node */
	navToggle(): void { this.navigation.navToggle(); }
	/** Select first visible node */
	navFirst(): void { this.navigation.navFirst(); }
	/** Select last visible node */
	navLast(): void { this.navigation.navLast(); }
	/** PageDown — jump forward ~10 visible nodes */
	navPageDown(): void { this.navigation.navPageDown(); }
	/** PageUp — jump back ~10 visible nodes */
	navPageUp(): void { this.navigation.navPageUp(); }

	// ── Shift+navigation: extend highlight range ────────────────────
	/** Shift+ArrowDown — extend highlight to next visible node */
	navHighlightNext(): void { this.navigation.navHighlightNext(); }
	/** Shift+ArrowUp — extend highlight to previous visible node */
	navHighlightPrev(): void { this.navigation.navHighlightPrev(); }
	/** Shift+Home — extend highlight to first visible node */
	navHighlightFirst(): void { this.navigation.navHighlightFirst(); }
	/** Shift+End — extend highlight to last visible node */
	navHighlightLast(): void { this.navigation.navHighlightLast(); }
	/** Shift+PageDown — extend highlight forward ~10 visible nodes */
	navHighlightPageDown(): void { this.navigation.navHighlightPageDown(); }
	/** Shift+PageUp — extend highlight back ~10 visible nodes */
	navHighlightPageUp(): void { this.navigation.navHighlightPageUp(); }

	/** Create the default flat-list navigation strategy (used by the HTML tree renderer) */
	createDefaultNavigation(): TreeNavigation<T> {
		return {
			navTo: (path: string) => {
				const node = this.getNodeByPath(path);
				if (!node) return;
				this.highlightNode(path, 'replace');
				this.scrollToPath(path, { expand: false, highlight: false, containerScroll: true });
			},

			navNextSibling: () => {
				const flatNodes = this.allFlatNodes;
				if (flatNodes.length === 0) return;
				const currentPath = this.focusedNode?.path;
				const currentIndex = currentPath ? flatNodes.findIndex(n => n.path === currentPath) : -1;
				if (currentIndex === -1) {
					this.navigation.navTo(flatNodes[0].path);
					return;
				}
				const currentLevel = flatNodes[currentIndex].level;
				for (let i = currentIndex + 1; i < flatNodes.length; i++) {
					if (flatNodes[i].level === currentLevel) {
						this.navigation.navTo(flatNodes[i].path);
						return;
					}
				}
			},

			navPrevSibling: () => {
				const flatNodes = this.allFlatNodes;
				if (flatNodes.length === 0) return;
				const currentPath = this.focusedNode?.path;
				const currentIndex = currentPath ? flatNodes.findIndex(n => n.path === currentPath) : -1;
				if (currentIndex === -1) {
					this.navigation.navTo(flatNodes[flatNodes.length - 1].path);
					return;
				}
				const currentLevel = flatNodes[currentIndex].level;
				for (let i = currentIndex - 1; i >= 0; i--) {
					if (flatNodes[i].level === currentLevel) {
						this.navigation.navTo(flatNodes[i].path);
						return;
					}
				}
			},

			navInto: () => {
				const currentPath = this.focusedNode?.path;
				if (!currentPath) return;
				const node = this.getNodeByPath(currentPath);
				if (!node) return;
				const flatNodes = this.allFlatNodes;
				const currentIndex = flatNodes.findIndex(n => n.path === currentPath);

				if (node.hasChildren && !node.isExpanded && node.isCollapsible !== false) {
					this.expandNodes(currentPath);
					tick().then(() => {
						const updatedFlat = this.allFlatNodes;
						const idx = updatedFlat.findIndex(n => n.path === currentPath);
						if (idx >= 0 && idx + 1 < updatedFlat.length) {
							this.navigation.navTo(updatedFlat[idx + 1].path);
						}
					});
				} else if (node.hasChildren && node.isExpanded) {
					const nextIdx = currentIndex + 1;
					if (nextIdx < flatNodes.length) {
						this.navigation.navTo(flatNodes[nextIdx].path);
					}
				}
			},

			navOut: () => {
				const currentPath = this.focusedNode?.path;
				if (!currentPath) return;
				const node = this.getNodeByPath(currentPath);
				if (!node?.parentPath) return;
				this.navigation.navTo(node.parentPath);
			},

			navBackOut: () => {
				const currentPath = this.focusedNode?.path;
				if (!currentPath) return;
				const node = this.getNodeByPath(currentPath);
				if (!node?.parentPath) return;
				const parent = this.getNodeByPath(node.parentPath);
				if (!parent) return;
				if (parent.hasChildren && parent.isExpanded && parent.isCollapsible !== false) {
					this.collapseNodes(parent.path);
					parent._rev = (parent._rev || 0) + 1;
				}
				tick().then(() => {
					this.navigation.navTo(parent.path);
				});
			},

			navToggle: () => {
				const currentPath = this.focusedNode?.path;
				if (!currentPath) return;
				const node = this.getNodeByPath(currentPath);
				if (!node?.hasChildren || node.isCollapsible === false) return;
				if (node.isExpanded) {
					this.collapseNodes(currentPath);
				} else {
					this.expandNodes(currentPath);
				}
			},

			navFirst: () => {
				const flatNodes = this.allFlatNodes;
				if (flatNodes.length > 0) {
					this.navigation.navTo(flatNodes[0].path);
				}
			},

			navLast: () => {
				const flatNodes = this.allFlatNodes;
				if (flatNodes.length > 0) {
					this.navigation.navTo(flatNodes[flatNodes.length - 1].path);
				}
			},

			navPageDown: () => {
				const flatNodes = this.allFlatNodes;
				if (flatNodes.length === 0) return;
				const currentPath = this.focusedNode?.path;
				const currentIndex = currentPath ? flatNodes.findIndex(n => n.path === currentPath) : -1;
				const targetIndex = Math.min((currentIndex === -1 ? 0 : currentIndex) + 10, flatNodes.length - 1);
				this.navigation.navTo(flatNodes[targetIndex].path);
			},

			navPageUp: () => {
				const flatNodes = this.allFlatNodes;
				if (flatNodes.length === 0) return;
				const currentPath = this.focusedNode?.path;
				const currentIndex = currentPath ? flatNodes.findIndex(n => n.path === currentPath) : flatNodes.length;
				const targetIndex = Math.max((currentIndex === -1 ? flatNodes.length : currentIndex) - 10, 0);
				this.navigation.navTo(flatNodes[targetIndex].path);
			},

			// ── Shift+navigation: extend highlight range ────────────
			navHighlightNext: () => {
				const flatNodes = this.allFlatNodes;
				if (flatNodes.length === 0) return;
				const currentPath = this.focusedNode?.path;
				const currentIndex = currentPath ? flatNodes.findIndex(n => n.path === currentPath) : -1;
				if (currentIndex === -1) return;
				// Move to next node at same level
				const currentLevel = flatNodes[currentIndex].level;
				for (let i = currentIndex + 1; i < flatNodes.length; i++) {
					if (flatNodes[i].level === currentLevel) {
						this._navHighlightTo(flatNodes[i].path);
						return;
					}
				}
			},

			navHighlightPrev: () => {
				const flatNodes = this.allFlatNodes;
				if (flatNodes.length === 0) return;
				const currentPath = this.focusedNode?.path;
				const currentIndex = currentPath ? flatNodes.findIndex(n => n.path === currentPath) : -1;
				if (currentIndex === -1) return;
				const currentLevel = flatNodes[currentIndex].level;
				for (let i = currentIndex - 1; i >= 0; i--) {
					if (flatNodes[i].level === currentLevel) {
						this._navHighlightTo(flatNodes[i].path);
						return;
					}
				}
			},

			navHighlightFirst: () => {
				const flatNodes = this.allFlatNodes;
				if (flatNodes.length > 0) {
					this._navHighlightTo(flatNodes[0].path);
				}
			},

			navHighlightLast: () => {
				const flatNodes = this.allFlatNodes;
				if (flatNodes.length > 0) {
					this._navHighlightTo(flatNodes[flatNodes.length - 1].path);
				}
			},

			navHighlightPageDown: () => {
				const flatNodes = this.allFlatNodes;
				if (flatNodes.length === 0) return;
				const currentPath = this.focusedNode?.path;
				const currentIndex = currentPath ? flatNodes.findIndex(n => n.path === currentPath) : -1;
				if (currentIndex === -1) return;
				const targetIndex = Math.min(currentIndex + 10, flatNodes.length - 1);
				this._navHighlightTo(flatNodes[targetIndex].path);
			},

			navHighlightPageUp: () => {
				const flatNodes = this.allFlatNodes;
				if (flatNodes.length === 0) return;
				const currentPath = this.focusedNode?.path;
				const currentIndex = currentPath ? flatNodes.findIndex(n => n.path === currentPath) : -1;
				if (currentIndex === -1) return;
				const targetIndex = Math.max(currentIndex - 10, 0);
				this._navHighlightTo(flatNodes[targetIndex].path);
			}
		};
	}

	/** Extend highlight to target path (Shift+nav) — uses range from the shift cursor
	 *  (or current focus if no cursor yet), moves focus. No-op in single mode. */
	private _navHighlightTo(path: string) {
		if (this.selectionMode !== 'multi') return;
		// Seed the shift cursor from the focused node on the first Shift+Arrow
		if (!this._shiftCursor && this.focusedNode) {
			const anchorNode = this.focusedNode;
			this._shiftCursor = anchorNode.path;
			// Ensure anchor is highlighted so range computation has a starting point visible
			if (anchorNode.isSelectable && !anchorNode.isHighlighted) {
				anchorNode.isHighlighted = true;
				anchorNode._rev = (anchorNode._rev || 0) + 1;
				this.highlightedPaths = new Set([anchorNode.path]);
			}
		}
		this.highlightNode(path, 'range');
		// Move focus to the target without clearing highlights
		const node = this.tree.getNodeByPath(path);
		if (node) this._setFocusedNode(node);
		this.scrollToPath(path, { expand: false, highlight: false, containerScroll: true });
		this.tree.refresh();
	}

	findScrollableAncestor(element: HTMLElement): HTMLElement | null {
		let parent = element.parentElement;
		while (parent) {
			const style = getComputedStyle(parent);
			const overflowY = style.overflowY;
			if (
				(overflowY === 'auto' || overflowY === 'scroll') &&
				parent.scrollHeight > parent.clientHeight
			) {
				return parent;
			}
			parent = parent.parentElement;
		}
		return null;
	}
}
