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
	type CascadeSelectPolicy,
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
 * Context passed per node to BOTH direction transforms — nodeOutputTransformationCallback
 * (egress: as a node LEAVES the source into a clipboard buffer or a drag) and
 * nodeInputTransformationCallback (ingress: as a duplicate LANDS in a destination). `phase`
 * says which direction is running; `target` is null during the 'output' phase (no destination
 * chosen yet) and populated during 'input'. `source` is the origin side — always carries the
 * path; node/parent/siblings are live when reachable (same-tree) and null/[] cross-tree or
 * once a cut source has been removed.
 *
 * These fire for BOTH clipboard and drag: 'output' on Ctrl+C/X + the capture side of a
 * copy-drop; 'input' on Ctrl+V paste + the insert side of a copy-drop. A plain MOVE fires
 * neither (nothing is duplicated).
 *
 * Symmetric by design: the same field means the same thing in both directions, so a naming/id
 * derivation reads identically whether you clean data on egress or derive it on ingress. Return
 * new data to derive ids/values/names; from the INPUT transform return null to skip a node
 * (skipping a root skips its whole subtree). Pure — reads the pristine snapshot, never mutates
 * it, so repeat inserts stay clean.
 */
export interface NodeTransformContext<T> {
	operation: 'copy' | 'cut';
	/** Direction: 'output' as a node leaves the source (egress), 'input' as a duplicate lands
	 *  in the destination (ingress). */
	phase: 'output' | 'input';
	/** True for a top-level node, false for a descendant riding along inside it. */
	isRoot: boolean;
	/** Index of the root entry within this batch (descendants share their root's index). */
	index: number;
	/** How the roots land relative to `target.node` — null during the 'output' phase
	 * (no destination chosen yet). Mirrors the DropPosition vocabulary of onNodeDrop. */
	position: 'child' | 'before' | 'after' | null;
	/** The origin side. `path` is always present; node/parent/siblings are live when the
	 * source is reachable (same-tree) and null/[] cross-tree or after a cut removed it. */
	source: NodeRef<T>;
	/** The destination side, symmetric with `source` — null during the 'output' phase. `node`
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
	event: DragEvent | PointerEvent;
	/** The full top-level set being dragged (multi-selection; a single-item array otherwise). */
	dragged: NodeRef<T>[];
}

/**
 * Context for beforeDragStartCallback — the set-level pre-drag interceptor. Fires ONCE at
 * drag start (a drag is single-origin at the DOM level), BEFORE onNodeDragStart and before
 * anything is published cross-tree. `lead` is the node physically grabbed; `dragged` is the
 * tree's default top-level set (the isDraggable-filtered highlight, or just `lead`).
 *
 * The callback returns the set the tree should ACTUALLY drag:
 *  - `string[]` — an authoritative REPLACEMENT list of top-level paths, in landing order. It
 *    may drop members of `dragged` AND add paths that weren't in it (even paths a
 *    getIsDraggableCallback would reject — forcing them in is the point). The tree normalizes
 *    the result (dedupe + drop any path that is a descendant of another path in the set) so an
 *    injected parent+child can't move the same node twice.
 *  - `false` — cancel the drag entirely.
 *  - `void`/`undefined` — keep the default `dragged` set.
 *
 * Synchronous only: it runs inside the native `dragstart`, so a returned Promise cannot veto
 * (the browser has already committed the drag by the next tick).
 */
export interface DragStartContext<T> {
	/** The node physically grabbed (the drag's lead / anchor). */
	lead: NodeRef<T>;
	/** The tree's default top-level dragged set before the callback (isDraggable-filtered). */
	dragged: NodeRef<T>[];
	/** The originating event — a PointerEvent for the pointer-driven drag (mouse/pen/touch);
	 *  DragEvent/TouchEvent retained for the legacy custom-renderer public API. */
	event: DragEvent | TouchEvent | PointerEvent;
}

/**
 * Context for beforeDropCallback — the drop interceptor. Symmetric with NodeDropContext:
 * `target` is the drop node (null on an empty-tree / tree-zone / root drop), `dragged` the FULL
 * top-level dragged set (the lead is `dragged[0]`-ish; use it to reason about the whole set),
 * `position`/`operation` the resolved drop intent, `event` the DOM event. Async-capable.
 */
export interface BeforeDropContext<T> {
	target: NodeRef<T> | null;
	dragged: NodeRef<T>[];
	position: DropPosition;
	operation: DropOperation;
	event: DragEvent | TouchEvent | PointerEvent;
}

/**
 * One placement instruction returned by beforeDropCallback for content-addressed / "sort the
 * basket" routing: place every node in `paths` at `targetPath` with `position` (default
 * 'child'). Return an ARRAY of these to fan a single drop out to several destinations (e.g.
 * fruits → one node, vegetables → another). The library auto-executes groups for SAME-TREE
 * nodes (it moves them); cross-tree nodes can't be auto-moved (they don't live in this tree),
 * so for a cross-tree drop the consumer places them in the onNodeDrop event instead. Within a
 * group the first path lands at `targetPath`/`position` and the rest chain 'after' it, so group
 * order is preserved. A path omitted from every group is simply not placed (per-item reject).
 */
export interface DropGroup {
	targetPath: string;
	position?: DropPosition;
	paths: string[];
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
	event: DragEvent | TouchEvent | PointerEvent;
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
	/** Unified pointer-driven drag entry (mouse/pen/touch). Replaces the native
	 *  draggable/dragstart + touchstart handlers on the node row. */
	onPointerDown: (node: LTreeNode<T>, event: PointerEvent) => void;
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
	displayValueFallback?: string;

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
	 * Which paths `selectedPaths` / `onSelectionChange` EMIT in cascade mode
	 * (rolled-up | leaves | all). Orthogonal to `checkboxMode`. Ignored in
	 * `'independent'` mode. Default `'rolled-up'`.
	 */
	cascadeSelectPolicy?: CascadeSelectPolicy | null | undefined;
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
	beforeCheckboxToggleCallback?: (
		node: LTreeNode<T>,
		checked: boolean,
		affectedPaths: string[]
	) => boolean | string[] | void;
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
	/** Fired when a long-press (touch) engages on a NON-draggable node — the user tried to
	 *  move something locked. Fire-and-forget; carries the locked node's NodeRef. The source-side
	 *  twin of a drop rejection; use it for a toast/snackbar/custom haptic. */
	onNodeDragDenied?: (ctx: NodeEventContext<T>) => void;
	/** Fired when a drop is REJECTED because the target node refuses it (`isDropAllowed` false /
	 *  getIsDropAllowedCallback). The target-side twin of onNodeDragDenied; carries the refusing
	 *  node's NodeRef. Not fired when a tree-drop-zone catches the forwarded drop instead. */
	onNodeDropDenied?: (ctx: NodeEventContext<T>) => void;
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
	 * `nodeInputTransformationCallback` for id/name derivation.
	 */
	shouldHandleKeyboardShortcuts?: boolean;

	// INTERCEPTORS (before*Callback = can modify/block)
	/** Runs before the built-in Delete removes anything. Return a narrowed path[] to
	 *  restrict what's removed, or `false` to block entirely. `nodes` are the resolved
	 *  top-level nodes about to be removed (descendants ride along). */
	beforeDeleteCallback?: (ctx: BeforeDeleteContext<T>) => string[] | false | void;
	/**
	 * Drop interceptor. Fires just before placement with a BeforeDropContext (symmetric with
	 * NodeDropContext: `target`, full `dragged` set, `position`, `operation`, `event`). Return:
	 *  - `false` — block the whole drop;
	 *  - `{ position?, operation? }` — redirect where/how the single drop lands;
	 *  - `DropGroup[]` — content-addressed routing: fan the drop out to several destinations
	 *    (each group = `{ targetPath, position?, paths }`); the library auto-executes groups for
	 *    same-tree nodes, cross-tree nodes are left for the consumer's onNodeDrop;
	 *  - `void` — proceed normally. Async-capable (await a confirm dialog, etc.).
	 */
	beforeDropCallback?: (
		ctx: BeforeDropContext<T>
	) =>
		| boolean
		| { position?: DropPosition; operation?: DropOperation }
		| DropGroup[]
		| void
		| Promise<
				boolean | { position?: DropPosition; operation?: DropOperation } | DropGroup[] | void
		  >;
	/**
	 * Set-level pre-drag interceptor. Runs once at drag start, before onNodeDragStart. Return
	 * an authoritative `string[]` of top-level paths to REPLACE the dragged set (prune members
	 * and/or force-add nodes that can't be omitted), `false` to cancel the drag, or `void` to
	 * keep the default. Synchronous (native dragstart — a Promise cannot veto). See
	 * DragStartContext for the full contract.
	 */
	beforeDragStartCallback?: (ctx: DragStartContext<T>) => string[] | false | void;
	beforeCopyCallback?: (ctx: BeforeCopyContext<T>) => string[] | false | void;
	beforeCutCallback?: (ctx: BeforeCopyContext<T>) => string[] | false | void;
	beforePasteCallback?: (
		ctx: BeforePasteContext<T>
	) => { targetPath?: string; position?: 'child' | 'before' | 'after' } | false | void;
	/** OUTPUT transform (egress) — per node as it LEAVES the source: Ctrl+C/X onto the
	 *  clipboard, or the capture side of a copy-drop. Use to strip transient/sensitive fields
	 *  before the data travels. Fires for copy, never for a move. */
	nodeOutputTransformationCallback?: (data: T, ctx: NodeTransformContext<T>) => T;
	/** INPUT transform (ingress) — per node as a DUPLICATE LANDS in a destination: Ctrl+V
	 *  paste, or the insert side of a copy-drop (same- or cross-tree). Return new data (fresh
	 *  ids/values/names) or null to skip the node (skipping a root skips its subtree). Pure:
	 *  reads the pristine snapshot, never mutates it. Fires for copy, never for a move. */
	nodeInputTransformationCallback?: (data: T, ctx: NodeTransformContext<T>) => T | null;

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
	touchDragDelay?: number | null | undefined;
	shouldIndicateUndraggable?: boolean;
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
	/** Public accessor for the Shift-range anchor (`_shiftCursor`). Lets alternative
	 *  renderers (e.g. the canvas package) read the current anchor to build their own
	 *  range selection (2D bounding-box hit-test) and write it back so subsequent
	 *  logical Shift+click ranges stay in sync. Mirrors `focusedNode` as public state. */
	get highlightAnchor(): string | null {
		return this._shiftCursor;
	}
	set highlightAnchor(path: string | null) {
		this._shiftCursor = path;
	}
	/** Manual double-click detection state. We can't rely on the browser's native
	 *  dblclick event because the first click triggers focus → _setFocusedNode bumps
	 *  node._rev → flat-mode {#each} destroys and recreates the row, so the second
	 *  click lands on a different DOM element and the browser refuses to synthesize a
	 *  dblclick. Tracking the click on the controller (which survives the re-render)
	 *  sidesteps that. Drives both the public onNodeDoubleClick event (all
	 *  clickBehaviors) and the built-in expand/collapse-on-double for 'select' mode. */
	private _lastClickPath: string | null = null;
	private _lastClickTime: number = 0;
	/**
	 * CANONICAL checkbox state: every fully-checked node (leaves + fully-checked
	 * branches). This is what every internal mutation reads/writes. The PUBLIC
	 * `selectedPaths` getter still returns this (back-compat: "all checked nodes"),
	 * but the value that flows OUT through the bindable prop + `onSelectionChange`
	 * is the policy PROJECTION (`#emittedPaths`, see `cascadeSelectPolicy`).
	 */
	#selectedPaths = $state.raw<Set<string>>(new Set());
	/** Policy-projected view of `#selectedPaths` (rolled-up | leaves | all). Kept in
	 *  sync by the `selectedPaths` setter and the `cascadeSelectPolicy`/`checkboxMode`
	 *  setters. This is the emitted selection surface. */
	#emittedPaths = $state.raw<Set<string>>(new Set());
	get selectedPaths(): Set<string> {
		return this.#selectedPaths;
	}
	set selectedPaths(value: Set<string>) {
		this.#selectedPaths = value;
		this.#emittedPaths = this._projectSelection(value);
	}
	/** The emitted (policy-projected) selection set — what `bind:selectedPaths` and
	 *  `onSelectionChange` expose. Equals the canonical set in independent mode or
	 *  under the `'all'` policy. */
	get emittedPaths(): Set<string> {
		return this.#emittedPaths;
	}
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
	onNodeDragDeniedHandler: TreeControllerProps<T>['onNodeDragDenied'];
	onNodeDropDeniedHandler: TreeControllerProps<T>['onNodeDropDenied'];
	onCopyHandler: TreeControllerProps<T>['onCopy'];
	onCutHandler: TreeControllerProps<T>['onCut'];
	onPasteHandler: ((result: PasteResult<T>) => void) | undefined;
	onDeleteHandler: TreeControllerProps<T>['onDelete'];
	onRenderStartHandler: (() => void) | undefined;
	onRenderProgressHandler: ((stats: RenderStats) => void) | undefined;
	onRenderCompleteHandler: ((stats: RenderStats) => void) | undefined;

	// Interceptor handlers (before*Callback)
	beforeDragStartHandler: TreeControllerProps<T>['beforeDragStartCallback'];
	beforeDropHandler: TreeControllerProps<T>['beforeDropCallback'];
	beforeCopyHandler: TreeControllerProps<T>['beforeCopyCallback'];
	beforeCutHandler: TreeControllerProps<T>['beforeCutCallback'];
	beforePasteHandler: TreeControllerProps<T>['beforePasteCallback'];
	beforeDeleteHandler: TreeControllerProps<T>['beforeDeleteCallback'];
	outputTransformHandler: TreeControllerProps<T>['nodeOutputTransformationCallback'];
	inputTransformHandler: TreeControllerProps<T>['nodeInputTransformationCallback'];
	beforeCheckboxToggleHandler: TreeControllerProps<T>['beforeCheckboxToggleCallback'];

	// Data provider handlers (get*Callback)
	getContextMenuItemsHandler: TreeControllerProps<T>['getContextMenuItemsCallback'];

	// Visual config (for nodeConfig updates)
	clickBehavior = $state<ClickBehavior>('expand-and-focus');
	selectionMode = $state<SelectionMode>('single');
	shouldShowCheckboxes = $state(false);
	#checkboxMode = $state<CheckboxMode>('independent');
	get checkboxMode(): CheckboxMode {
		return this.#checkboxMode;
	}
	set checkboxMode(value: CheckboxMode) {
		if (this.#checkboxMode === value) return;
		this.#checkboxMode = value;
		this._reconcileVisualStatesForMode();
		// Switching independent⇄cascade changes whether the policy applies, so the
		// emitted projection can change even when the canonical set is untouched.
		this.#emittedPaths = this._projectSelection(this.#selectedPaths);
	}
	#cascadeSelectPolicy = $state<CascadeSelectPolicy>('rolled-up');
	get cascadeSelectPolicy(): CascadeSelectPolicy {
		return this.#cascadeSelectPolicy;
	}
	set cascadeSelectPolicy(value: CascadeSelectPolicy) {
		if (this.#cascadeSelectPolicy === value) return;
		this.#cascadeSelectPolicy = value;
		// Re-project the (unchanged) canonical set through the new policy and notify.
		this.#emittedPaths = this._projectSelection(this.#selectedPaths);
		this._notifySelectionChanged();
	}
	shouldClickToggleCheckbox = $state(false);
	expandIconClass = $state('stv__toggle-icon--expand');
	collapseIconClass = $state('stv__toggle-icon--collapse');
	leafIconClass = $state('stv__toggle-icon--leaf');
	toggleIconMode = $state<ToggleIconMode>('rotate');
	highlightedNodeClass = $state<string | null | undefined>(undefined);
	focusedNodeClass = $state<string | null | undefined>(undefined);
	nodeClass = $state<((node: LTreeNode<any>) => string | null | undefined) | undefined>(undefined);
	nodeContentClass = $state<((node: LTreeNode<any>) => string | null | undefined) | undefined>(
		undefined
	);
	dragOverNodeClass = $state<string | null | undefined>(undefined);
	dropZoneMode = $state<'floating' | 'glow'>('glow');
	dropZoneLayout = $state<'around' | 'above' | 'below' | 'wave' | 'wave2'>('around');
	dropZoneStart = $state<number | string>(33);
	dropZoneMaxWidth = $state(120);
	scrollHighlightTimeout = $state(4000);
	scrollHighlightClass = $state<string | null | undefined>('stv__node-content--scroll-highlight');
	contextMenuXOffset = $state(8);
	contextMenuYOffset = $state(0);

	/** Milliseconds to hold a touch before a touch-drag engages (long-press). */
	touchDragDelay = $state(300);

	/** Show the built-in blocked-action indicator (haptic buzz + no-entry icon) — held while a
	 *  locked node is long-pressed, and flashed on a target that refuses a drop. The
	 *  onNodeDragDenied / onNodeDropDenied events fire regardless of this flag. */
	shouldIndicateUndraggable = $state(true);

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
	// Authoritative top-level dragged path list when beforeDragStartCallback rewrote the set
	// (prune and/or force-add). Normalized (deduped, no path that descends from another in the
	// set), ordered = landing order. Consulted by _draggedRefs and the multi-drag move loop so
	// the consumer's decision drives ctx.dragged, the cross-tree publish, AND the actual move.
	// Null when no callback ran or it returned void. Cleared on drag end.
	private _dragSetOverride: string[] | null = null;
	hoveredNodeForDrop = $state.raw<LTreeNode<any> | null>(null);
	activeDropPosition = $state<DropPosition | null>(null);
	currentDropOperation = $state<DropOperation>('move');

	// Floating drop zones (rendered at Tree level with position:fixed)
	floatingZoneRect = $state<{ top: number; left: number; width: number; height: number } | null>(
		null
	);
	floatingHoveredZone = $state<'before' | 'after' | 'child' | null>(null);

	// Touch drag
	touchDragState = $state.raw<{
		node: LTreeNode<any> | null;
		startX: number;
		startY: number;
		isDragging: boolean;
		isDenied: boolean;
		ghostElement: HTMLElement | null;
		currentDropTarget: LTreeNode<any> | null;
		/** Pointer-drag metadata (unified mouse/pen/touch path). */
		pointerType?: string;
		pointerId?: number;
	}>({
		node: null,
		startX: 0,
		startY: 0,
		isDragging: false,
		isDenied: false,
		ghostElement: null,
		currentDropTarget: null
	});
	touchTimer: ReturnType<typeof setTimeout> | null = null;

	// Held "can't move this" indicator: shown while a locked node stays pressed, torn down on release.
	private _deniedBadgeEl: HTMLElement | null = null;
	private _deniedRowEl: HTMLElement | null = null;

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

	// Whole-tree drop zone (Tree.svelte `shouldEnableTreeDropZone`). When on, a node that
	// REJECTS a drop must NOT tear down the drag — the same drop event bubbles up to the
	// container's tree-zone handler, which needs `draggedNode` still live to route it.
	shouldEnableTreeDropZone = false;

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
		this.cascadeSelectPolicy = props.cascadeSelectPolicy ?? 'rolled-up';
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
		this.touchDragDelay = props.touchDragDelay ?? 300;
		this.shouldIndicateUndraggable = props.shouldIndicateUndraggable ?? true;
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
		this.onNodeDragDeniedHandler = props.onNodeDragDenied;
		this.onNodeDropDeniedHandler = props.onNodeDropDenied;
		this.onCopyHandler = props.onCopy;
		this.onCutHandler = props.onCut;
		this.onPasteHandler = props.onPaste;
		this.onDeleteHandler = props.onDelete;
		this.beforeDragStartHandler = props.beforeDragStartCallback;
		this.beforeDropHandler = props.beforeDropCallback;
		this.beforeCopyHandler = props.beforeCopyCallback;
		this.beforeCutHandler = props.beforeCutCallback;
		this.beforePasteHandler = props.beforePasteCallback;
		this.beforeDeleteHandler = props.beforeDeleteCallback;
		this.shouldHandleKeyboardShortcuts = props.shouldHandleKeyboardShortcuts ?? false;
		this.outputTransformHandler = props.nodeOutputTransformationCallback;
		this.inputTransformHandler = props.nodeInputTransformationCallback;
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
				sortCallback: props.sortCallback,
				displayValueFallback: props.displayValueFallback
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
			onNodeClicked: (node: LTreeNode<T>, modifiers?: SelectionModifiers) =>
				this._onNodeClicked(node, modifiers, { uiClick: true }),
			onCheckboxToggle: (node: LTreeNode<T>, options?: { skipFocus?: boolean }) =>
				this._onCheckboxToggle(node, options),
			onNodeRightClicked: this._onNodeRightClicked.bind(this),
			onPointerDown: this._onPointerDown.bind(this)
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

		// Virtual scroll: auto-measure row height from the first rendered node.
		// Virtual scroll assumes UNIFORM row heights: the spacer is count * rowHeight,
		// so if the measured height is smaller than the real row stride the spacer
		// under-estimates total content and the last rows fall outside the scroll
		// range (can't reach the bottom + near-bottom jitter). The flat rows carry no
		// inter-row margin in virtual mode (flatGap is forced off — see Tree.svelte),
		// so getBoundingClientRect().height is the exact, sub-pixel-accurate stride.
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
			const maxScrollTop = Math.max(0, this.vsTotalHeight - this.vsContainerRef.clientHeight);
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
				const targetNode = this.tree.tree.length > 1 ? this.tree.tree[1] : this.tree.tree[0];
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
				root
					.querySelector(`[data-tree-path="${prevHoveredDragPath}"] .stv__node-content`)
					?.classList.remove(prevDragOverClass);
			}
			if (current && cls) {
				root.querySelector(`[data-tree-path="${current}"] .stv__node-content`)?.classList.add(cls);
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

	collapseAll(nodePath?: string | string[] | null | undefined, options?: { noEmit?: boolean }) {
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
			typeof nodeOrPath === 'string' ? (this.tree?.getNodeByPath(nodeOrPath) ?? null) : nodeOrPath;
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
			parent: parentPath ? (this.tree?.getNodeByPath(parentPath) ?? null) : null,
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
			// A beforeDragStartCallback override is authoritative: resolve its paths directly
			// (bypassing the highlight-derived set AND the per-node isDraggable gate, since a
			// forced-in node is the whole point). Skips paths that no longer resolve.
			if (this._dragSetOverride) {
				return this._dragSetOverride
					.map((p) => this.tree?.getNodeByPath(p) ?? null)
					.filter((n): n is LTreeNode<T> => !!n)
					.map((n) => this.nodeRef(n));
			}
			return this._draggedTopLevel(draggedNode).map((n) => this.nodeRef(n));
		}
		const set = getDragSet();
		const paths = set && set.sourceTreeId === draggedNode.treeId ? set.paths : [draggedNode.path];
		return paths.map((p) => this.nodeRef(p));
	}

	/**
	 * Normalize a consumer-supplied drag manifest (from beforeDragStartCallback): dedupe and
	 * guarantee `leadPath` is present (you can prune siblings but not the node under the cursor).
	 * Descendants are KEPT — the manifest is handed straight to moveNodes, which resolves refs up
	 * front (no stale paths, so the old descendant-drop is unnecessary) and treats a descendant
	 * ABSENT from the manifest as a hole (left behind). Order is preserved (= landing order); the
	 * lead is appended only if the callback dropped it.
	 */
	private _normalizeDragManifest(paths: string[], leadPath: string): string[] {
		const seen = new Set<string>();
		const deduped: string[] = [];
		for (const p of paths) {
			if (!seen.has(p)) {
				seen.add(p);
				deduped.push(p);
			}
		}
		if (!seen.has(leadPath)) deduped.push(leadPath);
		return deduped;
	}

	/**
	 * Execute a beforeDropCallback `DropGroup[]` (content-addressed routing). For each group,
	 * move every same-tree path to `group.targetPath` at `group.position` (default 'child'); the
	 * first path lands at the target and the rest chain 'after' the previously moved node so group
	 * order is preserved (mirrors the multi-drag move loop). Cross-tree paths (not in this tree)
	 * can't be auto-moved and are skipped — the consumer places those in onNodeDrop. Fires
	 * onNodeDrop once with all placed nodes. Returns true when every attempted move succeeded.
	 */
	private _executeDropGroups(
		groups: DropGroup[],
		fireDrop: (dropped: LTreeNode<T>[] | null) => void
	): boolean {
		// Resolve every target + source to a LIVE node reference BEFORE moving anything: each
		// moveNode reassigns sibling paths, so a path string captured for a not-yet-processed
		// group would go stale. Nodes mutate their .path in place, so a held reference stays valid.
		const resolved = groups
			.filter((g) => g?.targetPath && g.paths?.length)
			.map((g) => ({
				targetNode: this.tree?.getNodeByPath(g.targetPath) ?? null,
				targetPath: g.targetPath,
				position: g.position ?? ('child' as DropPosition),
				nodes: g.paths
					.map((p) => this.tree?.getNodeByPath(p) ?? null)
					.filter((n): n is LTreeNode<T> => !!n)
			}));

		// Each group's paths are whole-subtree roots, so complete the manifest (no holes) and
		// hand it to moveNodes. Reading held refs' live .path keeps cross-group moves correct.
		const movedNodes: LTreeNode<T>[] = [];
		let allOk = true;
		for (const group of resolved) {
			if (!group.nodes.length) continue;
			const manifest = this._completeManifest(group.nodes.map((n) => n.path));
			const r = this.moveNodes(
				manifest,
				group.targetNode?.path ?? group.targetPath,
				group.position
			);
			movedNodes.push(...r.movedNodes);
			if (!r.success) allOk = false;
		}
		fireDrop(movedNodes.length ? movedNodes : null);
		return allOk;
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

	/**
	 * Expand a set of paths into a COMPLETE manifest: every descendant of every member is
	 * added. moveNodes treats a manifest as authoritative — a descendant that is present
	 * rides along, one that is ABSENT is a hole — so callers that just want to move whole
	 * subtrees (multi-drag, DropGroup routing) must complete their set first, otherwise every
	 * unlisted descendant would be read as a hole and left behind.
	 */
	private _completeManifest(paths: string[]): string[] {
		if (!this.tree) return paths;
		const set = new Set<string>(paths);
		for (const p of paths) {
			const n = this.tree.getNodeByPath(p);
			if (n) for (const dp of this._getDescendantPaths(n)) set.add(dp);
		}
		return [...set];
	}

	/**
	 * Complete a set of top-level dragged refs into the flattened manifest of live NodeRefs —
	 * every descendant included — for beforeDragStartCallback's ctx.dragged. The consumer filters
	 * this set and returns the kept manifest; whatever it drops from a moved subtree becomes a
	 * hole (left behind by moveNodes). Same-tree only (nodes are live at drag start).
	 */
	private _completeDraggedRefs(refs: NodeRef<T>[]): NodeRef<T>[] {
		return this._completeManifest(refs.map((r) => r.path)).map((p) => this.nodeRef(p));
	}

	/**
	 * Batch-move a COMPLETE manifest of nodes under a target, honoring "holes".
	 *
	 * `paths` is a complete manifest (see _completeManifest): every descendant of every moved
	 * node is expected to be present. Any real descendant of a moved subtree that is ABSENT
	 * from the manifest is a hole — it is LEFT BEHIND by re-homing it to its moved root's OLD
	 * parent (option ii: it physically stays where the subtree used to be) instead of
	 * travelling with the subtree. A complete (unfiltered) manifest has no holes → whole
	 * subtrees move, exactly as before.
	 *
	 * Every source + target is resolved to a live LTreeNode ref up front, so intermediate path
	 * reassignment (moveNode mutates .path in place) can't stale later items — no dedup needed.
	 * Cross-tree nodes (treeId mismatch) are skipped for the consumer to place. Roots (manifest
	 * entries whose parent is not itself in the manifest) are the subtrees physically moved:
	 * the first lands at target/position, the rest chain 'after' to preserve source order.
	 * Highlight/selection/focus remap happens per-move inside moveNode().
	 */
	moveNodes(
		paths: string[],
		targetPath: string,
		position: DropPosition
	): { success: boolean; movedNodes: LTreeNode<T>[]; leftBehind: LTreeNode<T>[]; error?: string } {
		const tree = this.tree;
		if (!tree)
			return { success: false, movedNodes: [], leftBehind: [], error: 'Tree not initialized' };

		const manifest = new Set(paths);

		// Resolve up front; skip unresolved / cross-tree nodes (consumer owns those).
		const resolved = paths
			.map((p) => tree.getNodeByPath(p))
			.filter((n): n is LTreeNode<T> => !!n && n.treeId === this.treeId);
		let allOk = resolved.length === paths.length;

		// Roots = manifest nodes whose parent path is not itself in the manifest.
		const roots = resolved.filter((n) => !n.parentPath || !manifest.has(n.parentPath));

		// Holes: a descendant whose PARENT is in the manifest (kept) but which is itself ABSENT
		// is a boundary hole — it would ride along unless extracted. Resolve to live refs up
		// front and remember its moved root's OLD parent, so we can re-home it there (option ii).
		// Its own descendants follow it, so only the boundary is recorded.
		const holes: { node: LTreeNode<T>; toParent: string }[] = [];
		for (const root of roots) {
			const oldParent = root.parentPath ?? '';
			for (const dp of this._getDescendantPaths(root)) {
				if (manifest.has(dp)) continue;
				const parent = dp.substring(0, dp.lastIndexOf(this.treePathSeparator));
				if (!manifest.has(parent)) continue; // parent is also a hole → rides along inside it
				const node = tree.getNodeByPath(dp);
				if (node) holes.push({ node, toParent: oldParent });
			}
		}

		// Re-home the holes BEFORE moving the roots, so the subtree moves no longer carry them.
		const leftBehind: LTreeNode<T>[] = [];
		for (const hole of holes) {
			const r = this.moveNode(hole.node.path, hole.toParent, 'child');
			if (r.success) leftBehind.push(hole.node);
			else allOk = false;
		}

		// Move the roots: first at target/position, the rest chain 'after' the previous one.
		const movedNodes: LTreeNode<T>[] = [];
		let prevMovedNode: LTreeNode<T> | null = null;
		for (const root of roots) {
			const tp = prevMovedNode ? prevMovedNode.path : targetPath;
			const pos: DropPosition = prevMovedNode ? 'after' : position;
			const r = this.moveNode(root.path, tp, pos);
			if (r.success) {
				prevMovedNode = root; // moveNode mutates in place → root.path is the new path
				movedNodes.push(root);
			} else {
				allOk = false;
			}
		}

		return { success: allOk, movedNodes, leftBehind };
	}

	/**
	 * Batch-DUPLICATE a COMPLETE manifest of nodes under a target — the copy-side twin of
	 * moveNodes. (Named `duplicateNodes`, not `copyNodes`: the latter is the clipboard
	 * "copy to clipboard" op; this one duplicates a subtree straight into a destination.)
	 *
	 * `paths` is a complete manifest (see _completeManifest): every descendant of every copied
	 * root is expected to be present. A descendant that is ABSENT from the manifest is a hole —
	 * but unlike a move (which re-homes the omitted node so it physically stays), a copy has
	 * nothing to re-home: the source never leaves, so the hole is simply NOT copied. Omission =
	 * "don't duplicate this node (and its subtree)".
	 *
	 * Roots (manifest entries whose parent is not itself in the manifest) are the subtrees
	 * duplicated: the first lands at target/position, the rest chain 'after' the previous copy to
	 * preserve source order. Each node's data flows through `transform` (the INPUT transform) with
	 * a full NodeTransformContext — return new data (fresh ids/names) or null to skip that node.
	 *
	 * `sourceTree` defaults to this tree (same-tree copy); pass another tree's Ltree to copy its
	 * live nodes into this one (cross-tree). Source refs are read live off `sourceTree`, so the
	 * manifest paths are resolved in the source tree's path space.
	 */
	duplicateNodes(
		paths: string[],
		targetPath: string,
		position: DropPosition,
		transform?: (data: T, ctx: NodeTransformContext<T>) => T | null,
		sourceTree?: Ltree<T>
	): { success: boolean; copiedNodes: LTreeNode<T>[]; skipped: number; error?: string } {
		const tree = this.tree;
		if (!tree)
			return { success: false, copiedNodes: [], skipped: 0, error: 'Tree not initialized' };
		const src = sourceTree ?? tree;
		const manifest = new Set(paths);

		// Resolve source nodes up front from the source tree; roots = manifest entries whose
		// parent isn't itself in the manifest (the subtrees we physically duplicate).
		const resolved = paths.map((p) => src.getNodeByPath(p)).filter((n): n is LTreeNode<T> => !!n);
		const roots = resolved.filter((n) => !n.parentPath || !manifest.has(n.parentPath));
		if (!roots.length)
			return { success: false, copiedNodes: [], skipped: 0, error: 'No source roots resolved' };

		// Leaf-aware landing: a 'child' copy onto a node that disallows 'child' lands beside it
		// (inside its parent), mirroring pasteNodes + the drag-drop position rules.
		let landTargetPath = targetPath;
		if (position === 'child' && landTargetPath !== '') {
			const t = tree.getNodeByPath(landTargetPath);
			if (t) {
				const allowed = this.getNodeAllowedDropPositions(t);
				if (allowed && allowed.length > 0 && !allowed.includes('child')) {
					landTargetPath = t.parentPath ?? '';
				}
			}
		}
		const parentPath =
			position === 'child'
				? landTargetPath
				: (tree.getNodeByPath(landTargetPath)?.parentPath ?? '');

		// Build the per-node context, symmetric with pasteNodes' ctxFor: `source` is the LIVE
		// origin node (+ parent/siblings) read off the source tree; `target` is the destination
		// anchor. Rebuilt per node so destination siblings are batch-aware.
		const ctxFor = (
			srcNode: LTreeNode<T>,
			isRoot: boolean,
			idx: number
		): NodeTransformContext<T> => {
			const srcParentPath = srcNode.parentPath ?? null;
			const srcParent = srcParentPath ? (src.getNodeByPath(srcParentPath) ?? null) : null;
			const anchorNode = landTargetPath ? (tree.getNodeByPath(landTargetPath) ?? null) : null;
			const anchorParentPath = anchorNode?.parentPath ?? null;
			return {
				operation: 'copy',
				phase: 'input',
				isRoot,
				index: idx,
				position,
				source: {
					path: srcNode.path,
					node: srcNode,
					parent: srcParent,
					siblings: srcParent ? (Object.values(srcParent.children) as LTreeNode<T>[]) : []
				},
				target: {
					path: landTargetPath,
					node: anchorNode,
					parent: anchorParentPath ? (tree.getNodeByPath(anchorParentPath) ?? null) : null,
					siblings: this.getChildren(anchorParentPath ?? '')
				}
			};
		};

		this._skipInsertArray = true;
		const copiedNodes: LTreeNode<T>[] = [];
		let skipped = 0;
		let lastError: string | undefined;
		let prevRootPath: string | null = null;

		for (let index = 0; index < roots.length; index++) {
			const root = roots[index];

			// First root lands at the drop anchor; the rest chain 'after' the previous copy.
			const siblingPath =
				prevRootPath !== null ? prevRootPath : position !== 'child' ? landTargetPath : undefined;
			const rootPosition: 'before' | 'after' | undefined =
				prevRootPath !== null ? 'after' : position !== 'child' ? position : undefined;

			// Per-node wrapper: gate on the manifest (an absent descendant is a hole → NOT copied),
			// then run the caller's input transform with a full context. `srcNode` is the live source
			// node the ltree recursion passes as the 2nd arg.
			const wrapped = (data: T, srcNode: LTreeNode<T>): T | null => {
				if (!manifest.has(srcNode.path)) return null; // hole → skip node + subtree
				if (!transform) return data;
				return transform(data, ctxFor(srcNode, srcNode === root, index));
			};

			const result = tree.copyNodeWithDescendants(
				root,
				parentPath,
				wrapped,
				siblingPath,
				rootPosition
			);
			if (result.success && result.rootNode) {
				copiedNodes.push(result.rootNode);
				prevRootPath = result.rootNode.path;
			} else {
				lastError = result.error;
				skipped++;
			}
		}

		tick().then(() => {
			this._skipInsertArray = false;
		});

		return {
			success: copiedNodes.length > 0,
			copiedNodes,
			skipped,
			error: copiedNodes.length === 0 ? (lastError ?? 'No nodes copied') : undefined
		};
	}

	/** Default INPUT transform for a copy-drop when the consumer supplies no
	 *  nodeInputTransformationCallback: uniquify the id so the duplicate doesn't collide with
	 *  the original. Consumers override to derive real ids/names (or return null to skip). */
	private _defaultCopyTransform = (data: T): T => {
		const idKey = this.tree?.idMember || 'id';
		const raw = data as Record<string, unknown>;
		return { ...raw, [idKey]: `${raw[idKey]}_copy_${Date.now()}` } as T;
	};

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
		transformData: (data: T, node: LTreeNode<T>) => T | null,
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
		// The optional OUTPUT transform then cleans the snapshot before it's stored, so
		// transient/sensitive fields never travel on the shared clipboard. The context is
		// the SAME NodeTransformContext the input transform sees (phase: 'output'), with the
		// real per-node source (path/node/parent/siblings) and target: null (no destination
		// chosen yet).
		const snapshot = (n: LTreeNode<T>, isRoot: boolean): T => {
			const snap = $state.snapshot(n.data) as T;
			if (!this.outputTransformHandler) return snap;
			return this.outputTransformHandler(snap, {
				operation,
				phase: 'output',
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
					node: targetPath ? (this.tree.getNodeByPath(targetPath) ?? null) : null
				},
				entries: workEntries
			});
			if (result === false) {
				const blocked: PasteResult<T> = {
					success: false,
					count: 0,
					skipped: 0,
					error: 'Paste blocked by beforePasteCallback'
				};
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
			const notFound: PasteResult<T> = {
				success: false,
				count: 0,
				skipped: 0,
				error: `Target node not found: ${targetPath}`
			};
			this.onPasteHandler?.(notFound);
			return notFound;
		}

		// Resolve the actual parent the roots land in (children of it = the siblings).
		const destParentPath = isRootPasteAfter
			? ''
			: position === 'child'
				? targetPath
				: (targetNodeAfter!.parentPath ?? '');

		const transform = transformData ?? this.inputTransformHandler ?? null;
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
			uiLogger.debug(
				`[clipboard] shouldAutoHandlePaste=false — forwarding ${workEntries.length} entries to consumer`
			);
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
			const srcNode = sameTree ? (this.tree.getNodeByPath(srcPath) ?? null) : null;
			const srcParentPath = srcNode?.parentPath ?? null;
			const tgtNode = anchorPath ? (this.tree.getNodeByPath(anchorPath) ?? null) : null;
			const tgtParentPath = tgtNode?.parentPath ?? null;
			return {
				operation,
				phase: 'input',
				isRoot,
				index: idx,
				position: pos,
				source: {
					path: srcPath,
					node: srcNode,
					parent: srcParentPath ? (this.tree.getNodeByPath(srcParentPath) ?? null) : null,
					siblings: srcNode ? this.getChildren(srcParentPath ?? '') : []
				},
				target: {
					path: anchorPath,
					node: tgtNode,
					parent: tgtParentPath ? (this.tree.getNodeByPath(tgtParentPath) ?? null) : null,
					siblings: this.getChildren(tgtParentPath ?? '')
				}
			};
		};

		for (let index = 0; index < workEntries.length; index++) {
			const entry = workEntries[index];

			// Per-entry self-paste guard: skip (don't abort the batch) an entry whose
			// destination is itself or its own descendant. Skipping one no longer drops
			// the rest — selecting a folder + its child still pastes the valid nodes.
			if (
				sameTree &&
				!isRootPasteAfter &&
				(destParentPath === entry.sourcePath || destParentPath.startsWith(entry.sourcePath + sep))
			) {
				skipped++;
				continue;
			}

			const rootData = apply(
				entry.data,
				ctxFor(targetPath, position, true, index, entry.sourcePath)
			);
			if (rootData === null) {
				skipped++;
				continue;
			} // transform vetoed this entry

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
			error:
				totalCount === 0
					? (lastError ?? (skipped > 0 ? 'All nodes skipped' : 'No nodes pasted'))
					: undefined
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
	 *   via nodeInputTransformationCallback) · Delete remove selection · Escape cancel cut.
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
			this.pasteNodes(this.focusedNode?.path ?? '', this.inputTransformHandler ?? null, 'child');
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
		dragLogger.debug('startDrag', {
			path: node.path,
			isDraggable: this.getNodeIsDraggable(node),
			hasDataTransfer: !!event.dataTransfer
		});
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
			dragLogger.debug('dragOver SKIP - no svelte-treeview type', {
				path: node.path,
				types: Array.from(event.dataTransfer?.types ?? [])
			});
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
			dragLogger.debug('dragOver REJECTED - mode not allowed', {
				path: node.path,
				dragDropMode: this.dragDropMode,
				isCrossTreeDrag,
				draggedTreeId: effectiveDraggedNode?.treeId,
				thisTreeId: this.treeId
			});
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
			dragLogger.debug('dragOver REJECTED - invalid drop (same node?)', {
				path: node.path,
				draggedPath: effectiveDraggedNode?.path
			});
			return;
		}

		event.preventDefault();
		this.hoveredNodeForDrop = node;
		this.currentDropOperation = this.isCopyAllowed && event.ctrlKey ? 'copy' : 'move';

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

		dragLogger.debug('dragOver OK', {
			target: node.path,
			position: this.activeDropPosition,
			operation: this.currentDropOperation,
			hasElement: !!element
		});
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
		dragLogger.debug('drop called', {
			target: node.path,
			draggedNode: this.draggedNode?.path,
			activeDropPosition: this.activeDropPosition
		});
		event.preventDefault();
		event.stopPropagation();

		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = this.isCopyAllowed && event.ctrlKey ? 'copy' : 'move';
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
			dragLogger.debug('drop check', {
				dropAllowed,
				isCrossTreeDrag,
				sameNode,
				draggedPath: this.draggedNode.path,
				targetPath: node.path,
				dragDropMode: this.dragDropMode,
				nodeIsDropAllowed: node.isDropAllowed
			});

			// Per-node opt-out gate.
			if (!node.isDropAllowed) {
				dragLogger.debug('drop REJECTED - node.isDropAllowed=false', { path: node.path });
				this._resetDragState();
				return;
			}

			if (dropAllowed && (isCrossTreeDrag || this.draggedNode.path !== node.path)) {
				const position = this.activeDropPosition || 'child';
				dragLogger.debug('drop EXECUTING', {
					from: this.draggedNode.path,
					to: node.path,
					position
				});
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
		dragLogger.debug('dropAt', {
			target: node.path,
			position,
			draggedNode: this.draggedNode?.path
		});
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
			dragLogger.debug('dropAt EXECUTING', {
				from: this.draggedNode.path,
				to: node.path,
				position
			});
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
			const nodeIndex = this.allFlatNodes.findIndex((n) => n.path === path);
			if (nodeIndex === -1) {
				console.warn(`[Tree ${this.treeId}] Node not found in flat nodes for path: ${path}`);
				perfEnd(`[${this.treeId}] scrollToPath`);
				return false;
			}

			// Scroll virtual container to center the node
			const targetScroll =
				nodeIndex * this.vsRowHeight - this.vsContainerRef.clientHeight / 2 + this.vsRowHeight / 2;
			this.vsContainerRef.scrollTo({
				top: Math.max(0, targetScroll),
				behavior: scrollOptions?.behavior || 'smooth'
			});

			// Wait for scroll + re-render — need multiple frames for
			// rAF-throttled scroll handler → reactive update → DOM render
			await tick();
			await new Promise((r) => requestAnimationFrame(r));
			await tick();
			await new Promise((r) => requestAnimationFrame(r));

			if (highlight && this.scrollHighlightClass) {
				const elementId = `${this.treeId}-${node.id}`;
				if (!this.applyHighlight(elementId)) {
					// Element might not be rendered yet — retry after another frame
					await tick();
					await new Promise((r) => requestAnimationFrame(r));
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
		if (updates.highlightedPaths !== undefined)
			this.highlightedPaths = updates.highlightedPaths ?? new Set();
		if (updates.selectedPaths !== undefined)
			// Incoming set is a projection intent — expand it (cascade-down) into the
			// canonical checked state rather than storing it raw.
			this.setSelectedPaths([...(updates.selectedPaths ?? new Set<string>())], { silent: true });
		if (updates.cascadeSelectPolicy !== undefined)
			this.cascadeSelectPolicy = updates.cascadeSelectPolicy ?? 'rolled-up';
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

		if (updates.isVirtualScrollEnabled !== undefined)
			this.isVirtualScrollEnabled = updates.isVirtualScrollEnabled ?? false;
		if (updates.virtualRowHeight !== undefined) this.virtualRowHeight = updates.virtualRowHeight;
		if (updates.virtualOverscan !== undefined) this.virtualOverscan = updates.virtualOverscan ?? 5;
		if (updates.virtualContainerHeight !== undefined)
			this.virtualContainerHeight = updates.virtualContainerHeight;

		if (updates.clickBehavior !== undefined)
			this.clickBehavior = updates.clickBehavior ?? 'expand-and-focus';
		if (updates.selectionMode !== undefined) this.selectionMode = updates.selectionMode ?? 'single';
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
		if (updates.focusedNodeClass !== undefined) this.focusedNodeClass = updates.focusedNodeClass;
		if (updates.nodeClass !== undefined) this.nodeClass = updates.nodeClass;
		if (updates.nodeContentClass !== undefined) this.nodeContentClass = updates.nodeContentClass;
		if (updates.dragOverNodeClass !== undefined) this.dragOverNodeClass = updates.dragOverNodeClass;
		if (updates.dropZoneMode !== undefined) this.dropZoneMode = updates.dropZoneMode ?? 'glow';
		if (updates.dropZoneLayout !== undefined)
			this.dropZoneLayout = updates.dropZoneLayout ?? 'around';
		if (updates.dropZoneStart !== undefined) this.dropZoneStart = updates.dropZoneStart ?? 33;
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
		if (updates.dragDropMode !== undefined) this.dragDropMode = updates.dragDropMode ?? 'none';
		if (updates.scrollHighlightTimeout !== undefined)
			this.scrollHighlightTimeout = updates.scrollHighlightTimeout ?? 4000;
		if (updates.scrollHighlightClass !== undefined)
			this.scrollHighlightClass =
				updates.scrollHighlightClass ?? 'stv__node-content--scroll-highlight';
		if (updates.contextMenuXOffset !== undefined)
			this.contextMenuXOffset = updates.contextMenuXOffset ?? 8;
		if (updates.contextMenuYOffset !== undefined)
			this.contextMenuYOffset = updates.contextMenuYOffset ?? 0;
		if (updates.touchDragDelay !== undefined)
			this.touchDragDelay = updates.touchDragDelay ?? 300;
		if (updates.displayValueFallback !== undefined)
			this.tree.displayValueFallback = updates.displayValueFallback ?? '[N/A]';
		if (updates.shouldIndicateUndraggable !== undefined)
			this.shouldIndicateUndraggable = updates.shouldIndicateUndraggable ?? true;

		// Callbacks
		if (updates.onNodeClick !== undefined) this.onNodeClickHandler = updates.onNodeClick;
		if (updates.onNodeDoubleClick !== undefined)
			this.onNodeDoubleClickHandler = updates.onNodeDoubleClick;
		if (updates.onNodeDragStart !== undefined)
			this.onNodeDragStartHandler = updates.onNodeDragStart;
		if (updates.onNodeDragOver !== undefined) this.onNodeDragOverHandler = updates.onNodeDragOver;
		if (updates.beforeDragStartCallback !== undefined)
			this.beforeDragStartHandler = updates.beforeDragStartCallback;
		if (updates.beforeDropCallback !== undefined)
			this.beforeDropHandler = updates.beforeDropCallback;
		if (updates.beforeCopyCallback !== undefined)
			this.beforeCopyHandler = updates.beforeCopyCallback;
		if (updates.beforeCutCallback !== undefined) this.beforeCutHandler = updates.beforeCutCallback;
		if (updates.beforePasteCallback !== undefined)
			this.beforePasteHandler = updates.beforePasteCallback;
		if (updates.beforeDeleteCallback !== undefined)
			this.beforeDeleteHandler = updates.beforeDeleteCallback;
		if (updates.nodeOutputTransformationCallback !== undefined)
			this.outputTransformHandler = updates.nodeOutputTransformationCallback;
		if (updates.nodeInputTransformationCallback !== undefined)
			this.inputTransformHandler = updates.nodeInputTransformationCallback;
		if (updates.onNodeDrop !== undefined) this.onNodeDropHandler = updates.onNodeDrop;
		if (updates.onNodeDragDenied !== undefined)
			this.onNodeDragDeniedHandler = updates.onNodeDragDenied;
		if (updates.onNodeDropDenied !== undefined)
			this.onNodeDropDeniedHandler = updates.onNodeDropDenied;
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

	private async _onNodeClicked(
		node: LTreeNode<T>,
		modifiers?: SelectionModifiers,
		options?: { silent?: boolean; forceMultiSemantics?: boolean; uiClick?: boolean }
	) {
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
			const isDouble = this._lastClickPath === node.path && now - this._lastClickTime < 400;
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

		uiLogger.debug(`[highlight] Click on ${node.path}`, {
			ctrl,
			shift,
			mode: this.selectionMode,
			shiftCursor: this._shiftCursor,
			prevCount: this.highlightedPaths.size
		});

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
		const newChecked =
			this.checkboxMode === 'cascade' && node.visualState === VisualState.indeterminate
				? true
				: !node.isSelected;

		// If the clicked node is part of a multi-highlight, apply to all highlighted nodes
		const isMultiHighlighted =
			this.highlightedPaths.size > 1 && this.highlightedPaths.has(node.path);

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

	/**
	 * Re-derive every node's visualState (and keep isSelected/selectedPaths in sync)
	 * for the current checkboxMode, then re-render the nodes that changed. Called
	 * whenever checkboxMode flips so the switch is immediately consistent.
	 *
	 * - `cascade`: recompute each parent's indeterminate/selected from its descendants,
	 *   and sync isSelected for the definitive states (all children selected → parent
	 *   selected; none → unselected).
	 * - `independent`: there is no inherited indeterminate, so a node sitting at [-]
	 *   is promoted to fully CHECKED (isSelected = true) rather than dropped to
	 *   unchecked; every other node's visualState collapses to its own isSelected.
	 *
	 * Bumping `_rev` on changed nodes re-creates their row, which is what actually
	 * rewrites the checkbox's `indeterminate` DOM property — it's set imperatively, so
	 * without a re-render a stale cascade dash would stick at [-] even after the mode
	 * no longer wants it.
	 */
	private _reconcileVisualStatesForMode() {
		if (!this.tree?.root) return;
		const cascade = this.#checkboxMode === 'cascade';
		const newPaths = new Set<string>(this.selectedPaths);
		let anyChanged = false;
		let selectionChanged = false;
		const visit = (node: LTreeNode<T>) => {
			let vs: VisualState;
			let selectionTouched = false;
			if (cascade) {
				vs = this._computeVisualState(node);
				// Sync isSelected with a definitive computed state (leave indeterminate as-is).
				if (vs !== VisualState.indeterminate) {
					const shouldBeSelected = vs === VisualState.selected;
					if (node.isSelected !== shouldBeSelected) {
						node.isSelected = shouldBeSelected;
						if (shouldBeSelected) newPaths.add(node.path);
						else newPaths.delete(node.path);
						selectionTouched = true;
					}
				}
			} else if (node.visualState === VisualState.indeterminate) {
				// Independent mode has no partial state: promote [-] to fully checked.
				if (!node.isSelected) {
					node.isSelected = true;
					selectionTouched = true;
				}
				newPaths.add(node.path);
				vs = VisualState.selected;
			} else {
				vs = node.isSelected ? VisualState.selected : VisualState.notSelected;
			}
			if (node.visualState !== vs || selectionTouched) {
				node.visualState = vs;
				node._rev = (node._rev || 0) + 1;
				anyChanged = true;
				if (selectionTouched) selectionChanged = true;
			}
			for (const key in node.children) visit(node.children[key]!);
		};
		for (const key in this.tree.root.children) visit(this.tree.root.children[key]!);
		if (selectionChanged) this.selectedPaths = newPaths;
		if (anyChanged) {
			this.tree.refresh();
			if (selectionChanged) this._notifySelectionChanged();
		}
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

	/**
	 * Project the canonical checked set through the active `cascadeSelectPolicy`
	 * to produce the EMITTED selection (what the bindable `selectedPaths` prop and
	 * `onSelectionChange` expose). Pure — reads `node.isSelected` off the live tree,
	 * never mutates. See {@link CascadeSelectPolicy}.
	 *
	 * - independent mode OR `'all'` policy → the canonical set as-is (every
	 *   fully-checked node; canonical never contains an indeterminate branch).
	 * - `'leaves'` → only checked leaf nodes.
	 * - `'rolled-up'` → a fully-checked selectable branch collapses to its root
	 *   (stop descending); indeterminate branches descend to emit their checked bits.
	 */
	private _projectSelection(canonical: Set<string>): Set<string> {
		if (this.#checkboxMode !== 'cascade' || this.#cascadeSelectPolicy === 'all' || !this.tree) {
			return canonical;
		}
		const policy = this.#cascadeSelectPolicy;
		const out = new Set<string>();
		const walk = (node: LTreeNode<T>) => {
			const vs = this._computeVisualState(node);
			if (vs === VisualState.notSelected) return;
			const children = Object.values(node.children);
			const selectable = node.isSelectable !== false;
			if (policy === 'leaves') {
				if (children.length === 0 && node.isSelected && selectable) out.add(node.path);
				for (const child of children) walk(child);
				return;
			}
			// rolled-up: a fully-checked selectable node covers its whole subtree.
			if (vs === VisualState.selected && selectable) {
				out.add(node.path);
				return;
			}
			for (const child of children) walk(child);
		};
		for (const root of this.tree.tree) walk(root);
		return out;
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

	/** Notify listeners about checkbox selection change. Emits the POLICY-PROJECTED
	 *  set (`#emittedPaths`), matching what the bindable `selectedPaths` prop exposes. */
	private _notifySelectionChanged() {
		if (this.onSelectionChangeHandler) {
			const nodes: LTreeNode<T>[] = [];
			for (const path of this.#emittedPaths) {
				const node = this.tree.getNodeByPath(path);
				if (node) nodes.push(node);
			}
			this.onSelectionChangeHandler({ paths: this.#emittedPaths, nodes });
		}
	}

	/** Get nodes between two paths for range selection, respecting rangeSelectionMode */
	private _getNodesBetween(pathA: string, pathB: string): string[] {
		uiLogger.debug(
			`[multi-select] _getNodesBetween: ${pathA} → ${pathB}, mode=${this.rangeSelectionMode}`
		);
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
		uiLogger.debug(
			`[multi-select] _getVisibleNodesBetween: indexA=${indexA}, indexB=${indexB}, totalVisible=${flatNodes.length}`
		);
		if (indexA === -1 || indexB === -1) {
			uiLogger.debug(
				`[multi-select] _getVisibleNodesBetween: path not found in visible nodes, falling back to [${pathB}]`
			);
			return [pathB];
		}
		const start = Math.min(indexA, indexB);
		const end = Math.max(indexA, indexB);
		const result = flatNodes.slice(start, end + 1).map((n) => n.path);
		uiLogger.debug(
			`[multi-select] _getVisibleNodesBetween: selected ${result.length} visible nodes [${start}..${end}]`
		);
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
		uiLogger.debug(
			`[multi-select] _getAllNodesBetween: indexA=${indexA}, indexB=${indexB}, totalNodes=${allPaths.length}`
		);
		if (indexA === -1 || indexB === -1) {
			uiLogger.debug(
				`[multi-select] _getAllNodesBetween: path not found in tree, falling back to [${pathB}]`
			);
			return [pathB];
		}
		const start = Math.min(indexA, indexB);
		const end = Math.max(indexA, indexB);
		const result = allPaths.slice(start, end + 1);
		uiLogger.debug(
			`[multi-select] _getAllNodesBetween: selected ${result.length} nodes [${start}..${end}]`
		);
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
			this._onNodeClicked(
				node,
				{ ctrl: true, shift: false },
				{ ...options, forceMultiSemantics: true }
			);
		} else if (mode === 'range') {
			this._onNodeClicked(
				node,
				{ ctrl: false, shift: true },
				{ ...options, forceMultiSemantics: true }
			);
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
				if (!newPaths.has(path)) {
					newPaths.add(path);
					changed = true;
				}
				n.isSelected = true;
			} else {
				if (newPaths.has(path)) {
					newPaths.delete(path);
					changed = true;
				}
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
				if (rn.visualState !== vs) {
					rn.visualState = vs;
					rn._rev = (rn._rev || 0) + 1;
				}
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

	private calculateDropPosition(event: DragEvent | MouseEvent, element: Element): DropPosition {
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

		// Set-level pre-drag interceptor. Build the tree's default dragged set, hand it to the
		// consumer, and let them REPLACE it (prune and/or force-add nodes that can't be omitted),
		// cancel the drag, or leave it untouched. Runs BEFORE the cross-tree publish and
		// onNodeDragStart so both see the final set.
		this._dragSetOverride = null;
		let draggedRefs = this._draggedRefs(node);
		if (this.beforeDragStartHandler) {
			const decision = this.beforeDragStartHandler({
				lead: this.nodeRef(node),
				dragged: this._completeDraggedRefs(draggedRefs),
				event
			});
			if (decision === false) {
				// Cancel: prevent the native drag from starting and unwind the state we set.
				event.preventDefault();
				this.draggedNode = null;
				this.isDragInProgress = false;
				this._dragSetOverride = null;
				dragLogger.debug('[before-drag-start] drag cancelled by callback', { path: node.path });
				return;
			}
			if (Array.isArray(decision)) {
				this._dragSetOverride = this._normalizeDragManifest(decision, node.path);
				draggedRefs = this._draggedRefs(node); // republish through the override
				dragLogger.debug('[before-drag-start] drag set overridden', {
					requested: decision,
					normalized: this._dragSetOverride
				});
			}
		}

		// Publish the top-level set (→ ctx.dragged cross-tree) plus the PLACEMENT manifest a
		// cross-tree auto-copy feeds to duplicateNodes: a curated override keeps its holes,
		// a plain drag is completed so whole subtrees copy. (The target can't see this tree's
		// highlight set nor its _dragSetOverride, so both must be published here.)
		const placementManifest =
			this._dragSetOverride ?? this._completeManifest(draggedRefs.map((r) => r.path));
		setDragSet(
			this.treeId,
			draggedRefs.map((r) => r.path),
			placementManifest
		);
		// ALSO stash it in the dataTransfer: the module-level dragSet is cleared on the source's
		// dragend, which can fire BEFORE the target's drop under synthetic DnD — the dataTransfer
		// payload survives on the drop event, so cross-tree auto-copy reads the manifest from here.
		if (event instanceof DragEvent && event.dataTransfer) {
			try {
				event.dataTransfer.setData(
					'application/svelte-treeview-manifest',
					JSON.stringify({ sourceTreeId: this.treeId, manifest: placementManifest })
				);
			} catch {
				/* setData can throw outside a dragstart — ignore, dragSet still covers it */
			}
		}
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
				dragLogger.debug(
					'[drag-esc] snapshot captured',
					Array.from(this._preDragHighlightSnapshot)
				);
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
			dragLogger.debug('[drag-esc] restore complete', {
				highlightedPathsAfter: Array.from(this.highlightedPaths)
			});
		}
		this._preDragHighlightSnapshot = null;
		this._resetDragState();
	};

	private _resetDragState(): void {
		dragLogger.debug('_resetDragState');
		clearDragSet();
		this._dragSetOverride = null;
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
		event: DragEvent | TouchEvent | PointerEvent
	): Promise<boolean> {
		let operation: DropOperation = 'move';
		// ctrlKey lives on DragEvent, PointerEvent AND TouchEvent (all UIEvent modifiers),
		// so read it structurally rather than gating on `instanceof DragEvent` — the pointer
		// path delivers a PointerEvent, not a DragEvent.
		const ctrlKey = (event as { ctrlKey?: boolean }).ctrlKey === true;

		if (this.isCopyAllowed && ctrlKey) {
			operation = 'copy';
		}

		dragLogger.info(`Drop: ${draggedNodeRef.path} -> ${dropNode?.path ?? 'empty tree'}`, {
			position,
			operation,
			isCrossTree: draggedNodeRef.treeId !== this.treeId
		});

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

		if (this.beforeDropHandler) {
			const result = await this.beforeDropHandler({
				target: dropNode ? this.nodeRef(dropNode) : null,
				dragged: draggedRefs,
				position,
				operation,
				event
			});
			if (result === false) return false;
			if (Array.isArray(result)) {
				// Content-addressed routing: fan the drop out to the returned groups. Same-tree
				// nodes are moved by the library; cross-tree nodes can't be (not in this tree),
				// so they're left for the consumer's onNodeDrop. Paths in no group aren't placed.
				return this._executeDropGroups(result, fireDrop);
			}
			if (result && typeof result === 'object') {
				if ('position' in result && result.position) position = result.position;
				if ('operation' in result && result.operation) operation = result.operation;
			}
		}

		// Multi-drag (Decision 6 in selection-highlight-model.md):
		// When the dragged node is part of a multi-highlight, move the whole highlight
		// set as top-level-selected subtrees. Descendants whose nearest highlighted
		// ancestor is in the set are absorbed (ride along inside the subtree).
		// A beforeDragStartCallback override takes over as the authoritative set: "multi"
		// then means the override carries more than one top-level path (a single-highlight
		// grab can become a multi-move when the callback force-adds companions).
		const isMultiDrag =
			isSameTreeDrag &&
			operation === 'move' &&
			dropNode &&
			this.shouldAutoHandleMove &&
			(this._dragSetOverride
				? this._dragSetOverride.length > 1
				: this.highlightedPaths.has(draggedNodeRef.path) && this.highlightedPaths.size > 1);

		if (isMultiDrag) {
			const topLevelPaths = (this._dragSetOverride ?? this._getTopLevelHighlightedPaths())
				// drop target can't be moved onto itself
				.filter((p) => p !== dropNode!.path)
				// Respect per-node draggability: a locked node (isDraggable=false) that
				// merely happens to be in the highlight set must NOT ride along. The
				// single-drag path is already gated at drag *start*, but multi-drag
				// pulls straight from highlightedPaths, so it has to re-check here. An
				// explicit override skips this gate — the consumer forced these in on purpose,
				// so honor them even if getIsDraggableCallback would reject them.
				.filter((p) => {
					if (this._dragSetOverride) return !!this.tree.getNodeByPath(p);
					const n = this.tree.getNodeByPath(p);
					return n ? this.getNodeIsDraggable(n) : false;
				});
			dragLogger.info(`Multi-drag: moving ${topLevelPaths.length} top-level subtree(s)`, {
				topLevelPaths,
				totalHighlighted: this.highlightedPaths.size,
				dropTarget: dropNode!.path,
				position
			});
			// A curated override (from beforeDragStartCallback) IS the manifest as-is — it may omit
			// descendants on purpose, and those omissions are holes moveNodes leaves behind. A plain
			// highlight set carries no holes, so complete it (add every descendant) → whole subtrees
			// move. Either way moveNodes resolves refs up front (no stale paths — the old hand-rolled
			// loop needed dedup to avoid that), picks the roots, and chains them in source order under
			// dropNode: 'after D' → [D, A, B, C], 'before D' → [A, B, C, D], 'child of D' → [A, B, C].
			const manifest = this._dragSetOverride
				? topLevelPaths
				: this._completeManifest(topLevelPaths);
			const result = this.moveNodes(manifest, dropNode!.path, position);
			fireDrop(result.movedNodes);
			return result.success;
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
			// Copy twin of the move branches: build the same manifest (curated override with
			// holes, or the completed highlight/lead set = whole subtrees), then duplicateNodes
			// runs the INPUT transform per node — the consumer's nodeInputTransformationCallback,
			// else a default id-uniquifier. Multi-drag copies every root, exactly like move.
			const transform = this.inputTransformHandler ?? this._defaultCopyTransform;
			const isMulti = this._dragSetOverride
				? this._dragSetOverride.length > 1
				: this.highlightedPaths.has(draggedNodeRef.path) && this.highlightedPaths.size > 1;
			const manifest = this._dragSetOverride
				? this._dragSetOverride
				: isMulti
					? this._completeManifest(
							this._getTopLevelHighlightedPaths().filter((p) => p !== dropNode.path)
						)
					: this._completeManifest([draggedNodeRef.path]);
			const result = this.duplicateNodes(manifest, dropNode.path, position, transform);
			fireDrop(result.copiedNodes);
			return result.success;
		}

		if (!isSameTreeDrag && operation === 'copy' && this.shouldAutoHandleCopy) {
			// Cross-tree AUTO-copy: reach the SOURCE tree via the registry, read its published
			// PLACEMENT manifest (a curated beforeDragStart override keeps its holes; a plain drag
			// was completed to whole subtrees), and duplicate it into THIS tree. The source stays
			// put — a copy re-homes nothing. Falls through to the consumer if the source tree isn't
			// reachable (e.g. dropped from a foreign page).
			// Prefer the dataTransfer payload (survives the source's early dragend); fall back to the
			// module-level dragSet (same-page, still-live drags), then to just the lead path.
			let sourceTreeId = draggedNodeRef.treeId;
			let manifest: string[] | null = null;
			if (event instanceof DragEvent) {
				const raw = event.dataTransfer?.getData('application/svelte-treeview-manifest');
				if (raw) {
					try {
						const m = JSON.parse(raw) as { sourceTreeId?: string; manifest?: string[] };
						if (m.sourceTreeId) sourceTreeId = m.sourceTreeId;
						if (m.manifest) manifest = m.manifest;
					} catch {
						/* malformed payload — fall through to the dragSet */
					}
				}
			}
			if (!manifest) {
				const drag = getDragSet();
				if (drag) {
					sourceTreeId = drag.sourceTreeId;
					manifest = drag.manifest;
				}
			}
			if (!manifest) manifest = [draggedNodeRef.path];
			const sourceCtrl = getClipboardTree(sourceTreeId);
			const sourceTree = sourceCtrl ? (sourceCtrl.tree as Ltree<T> | undefined) : undefined;
			if (sourceTree) {
				const transform = this.inputTransformHandler ?? this._defaultCopyTransform;
				const result = this.duplicateNodes(
					manifest,
					dropNode ? dropNode.path : '',
					dropNode ? position : 'child',
					transform,
					sourceTree
				);
				fireDrop(result.copiedNodes);
				return result.success;
			}
		}

		// Cross-tree without a reachable source (or copy without shouldAutoHandleCopy): the
		// consumer performs the insertion, so the library placed nothing → dropped is null.
		fireDrop(null);
		return true;
	}

	// Floating drop zone: overlay before/after/child buttons rendered at Tree level (position:fixed
	// over the hovered row). Pointer drops on them are handled in _onPointerUp; this predicate just
	// gates which buttons render for the hovered node.
	isFloatingPositionAllowed(position: DropPosition): boolean {
		if (!this.hoveredNodeForDrop) return false;
		const allowed = this.tree.getNodeAllowedDropPositions(this.hoveredNodeForDrop);
		if (!allowed || allowed.length === 0) return true; // All positions allowed by default
		return allowed.includes(position);
	}

	// ── Unified Pointer Events drag manager (mouse / pen / touch) ─────────
	//
	// Replaces native HTML5 drag-and-drop. A drag is driven entirely from window-level
	// pointer listeners owned by the SOURCE controller: there is NO browser drag session,
	// so re-rendering or moving the dragged row mid-drag can't freeze the page (the failure
	// mode native DnD hits). Commit happens on pointerup (elementFromPoint → target row/tree).
	// Cross-tree drops are routed to the target tree's controller via the module-level
	// clipboard registry + dragSet — no dataTransfer needed (there's no drag session to carry it).

	private _boundPointerMove: ((e: PointerEvent) => void) | null = null;
	private _boundPointerUp: ((e: PointerEvent) => void) | null = null;
	private _boundPointerCancel: ((e: PointerEvent) => void) | null = null;
	private _boundPointerKeydown: ((e: KeyboardEvent) => void) | null = null;
	/** The controller whose hover state we last lit up (may be another tree for a cross-tree drag). */
	private _hoverCtrl: TreeController<any> | null = null;

	// Edge autoscroll: native DnD auto-scrolled the container near its edges; the pointer drag
	// has to do it itself, else off-screen drop targets are unreachable in a scrollable tree.
	private _lastPointerX = 0;
	private _lastPointerY = 0;
	private _lastPointerEvent: PointerEvent | null = null;
	private _autoScrollRAF: number | null = null;
	private _autoScrollEl: Element | null = null;
	private _autoScrollVy = 0;

	private _onPointerDown(node: LTreeNode<any>, event: PointerEvent) {
		// Only the primary button / primary pointer starts a drag; ignore right/middle click.
		if (event.button !== 0) return;
		if (this.dragDropMode === 'none') return;
		if (typeof window === 'undefined') return;

		const draggable = this.getNodeIsDraggable(node);
		// Mouse/pen on a locked node: nothing to do (denied feedback is a touch long-press affordance).
		if (event.pointerType !== 'touch' && !draggable) return;

		this.touchDragState = {
			node,
			startX: event.clientX,
			startY: event.clientY,
			isDragging: false,
			isDenied: false,
			ghostElement: null,
			currentDropTarget: null,
			pointerType: event.pointerType,
			pointerId: event.pointerId
		};

		this._addPointerListeners();

		if (event.pointerType === 'touch') {
			// Touch: long-press to engage (distinguishes a drag from a tap/scroll). A move past
			// threshold before the timer fires cancels it (treated as a scroll) in _onPointerMove.
			this.touchTimer = setTimeout(() => {
				if (!draggable) {
					this.touchDragState = { ...this.touchDragState, isDenied: true };
					this._indicateDragDenied(node);
					return;
				}
				this._engagePointerDrag(node, event);
			}, this.touchDragDelay);
		}
		// Mouse/pen: engage on the first move past threshold (no long-press) — handled in move.
	}

	private _engagePointerDrag(node: LTreeNode<any>, event: PointerEvent) {
		this.draggedNode = node;
		this.isDragInProgress = true;

		// Set-level pre-drag interceptor (same contract as the legacy paths). There's no native
		// drag to preventDefault here, so `false` simply aborts before the ghost appears.
		this._dragSetOverride = null;
		let draggedRefs = this._draggedRefs(node);
		if (this.beforeDragStartHandler) {
			const decision = this.beforeDragStartHandler({
				lead: this.nodeRef(node),
				dragged: this._completeDraggedRefs(draggedRefs),
				event
			});
			if (decision === false) {
				this._resetPointerState();
				return;
			}
			if (Array.isArray(decision)) {
				this._dragSetOverride = this._normalizeDragManifest(decision, node.path);
				draggedRefs = this._draggedRefs(node);
			}
		}

		this.touchDragState = { ...this.touchDragState, isDragging: true };
		setDragSet(
			this.treeId,
			draggedRefs.map((r) => r.path),
			this._dragSetOverride ?? this._completeManifest(draggedRefs.map((r) => r.path))
		);
		this.createGhostElement(node, event.clientX, event.clientY);
		this.onNodeDragStartHandler?.({ ...this.nodeRef(node), event, dragged: draggedRefs });

		// OS-convention selection sync: grabbing a node OUTSIDE the current highlight replaces
		// the highlight with just it (Explorer/Finder mousedown-selects). Done synchronously —
		// unlike the native path (which had to defer to rAF so re-rendering the source row
		// wouldn't abort the browser drag image), the pointer drag has no drag image to lose.
		if (node.isSelectable && !this.highlightedPaths.has(node.path)) {
			this._preDragHighlightSnapshot = new Set(this.highlightedPaths);
			this._clearAllHighlightFlags();
			node.isHighlighted = true;
			node._rev = (node._rev || 0) + 1;
			this.highlightedPaths = new Set([node.path]);
			this._shiftCursor = node.path;
			this._notifyHighlightChanged();
			this._mirrorHighlightToSelected();
			this.tree.refresh();
		}

		try {
			navigator.vibrate?.(50);
		} catch {
			/* blocked by browser policy */
		}
	}

	/** Restore the highlight captured at drag start (Esc-cancel / invalid drop). */
	private _restorePreDragHighlight() {
		const prior = this._preDragHighlightSnapshot;
		if (!prior) return;
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
	}

	private _onPointerMove(event: PointerEvent) {
		const st = this.touchDragState;
		if (!st.node) return;

		// Locked node held down (touch denied): keep the indicator up, swallow the move.
		if (st.isDenied) return;

		if (!st.isDragging) {
			const dx = Math.abs(event.clientX - st.startX);
			const dy = Math.abs(event.clientY - st.startY);
			if (st.pointerType === 'touch') {
				// Moved before the long-press engaged → it's a scroll, not a drag. Bail.
				if (dx > 10 || dy > 10) this._resetPointerState();
				return;
			}
			// Mouse/pen: engage once past a small threshold (draggability already gated in down).
			if (dx <= 5 && dy <= 5) return;
			this._engagePointerDrag(st.node, event);
			if (!this.touchDragState.isDragging) return; // callback vetoed the drag
		}

		event.preventDefault?.();

		const ghost = this.touchDragState.ghostElement;
		if (ghost) {
			ghost.style.left = `${event.clientX}px`;
			ghost.style.top = `${event.clientY}px`;
		}
		// Remember the live pointer so the autoscroll rAF can re-resolve the hover target while
		// the pointer sits still in an edge zone and the content scrolls under it.
		this._lastPointerX = event.clientX;
		this._lastPointerY = event.clientY;
		this._lastPointerEvent = event;

		const el = this._elementUnderPointer(event.clientX, event.clientY);
		this._updatePointerHover(el, event);
		this._updateAutoScroll(el, event.clientY);
	}

	/** elementFromPoint with the drag ghost briefly made click-through so it isn't the hit. */
	private _elementUnderPointer(x: number, y: number): Element | null {
		const ghost = this.touchDragState.ghostElement;
		if (ghost) ghost.style.pointerEvents = 'none';
		const el = document.elementFromPoint(x, y);
		if (ghost) ghost.style.pointerEvents = '';
		return el;
	}

	// ── Edge autoscroll ──────────────────────────────────────────────────

	/** Nearest vertically-scrollable ancestor of `el`, else the page scroller (or null). */
	private _findScrollable(el: Element | null): Element | null {
		let node: Element | null = el;
		while (node && node !== document.body && node !== document.documentElement) {
			const style = getComputedStyle(node);
			const oy = style.overflowY;
			if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 1) {
				return node;
			}
			node = node.parentElement;
		}
		const doc = document.scrollingElement;
		if (doc && doc.scrollHeight > doc.clientHeight + 1) return doc;
		return null;
	}

	/** Set the autoscroll velocity from how deep the pointer is in the scroller's top/bottom edge. */
	private _updateAutoScroll(el: Element | null, clientY: number) {
		const scroller = this._findScrollable(el);
		this._autoScrollEl = scroller;
		if (!scroller) {
			this._autoScrollVy = 0;
			return;
		}
		const ZONE = 48; // px from the edge where scrolling kicks in
		const MAX = 20; // px/frame at the very edge
		let top: number, bottom: number;
		if (scroller === document.scrollingElement) {
			top = 0;
			bottom = window.innerHeight;
		} else {
			const r = scroller.getBoundingClientRect();
			top = r.top;
			bottom = r.bottom;
		}
		let vy = 0;
		if (clientY < top + ZONE) vy = -MAX * Math.min(1, (top + ZONE - clientY) / ZONE);
		else if (clientY > bottom - ZONE) vy = MAX * Math.min(1, (clientY - (bottom - ZONE)) / ZONE);
		this._autoScrollVy = vy;
		if (vy !== 0) this._startAutoScroll();
	}

	private _startAutoScroll() {
		if (this._autoScrollRAF !== null || typeof requestAnimationFrame === 'undefined') return;
		const step = () => {
			if (!this.touchDragState.isDragging || this._autoScrollVy === 0 || !this._autoScrollEl) {
				this._autoScrollRAF = null;
				return;
			}
			this._autoScrollEl.scrollTop += this._autoScrollVy;
			// The pointer is stationary but content moved, so re-resolve the hover target under it.
			const el = this._elementUnderPointer(this._lastPointerX, this._lastPointerY);
			if (this._lastPointerEvent) this._updatePointerHover(el, this._lastPointerEvent);
			this._autoScrollRAF = requestAnimationFrame(step);
		};
		this._autoScrollRAF = requestAnimationFrame(step);
	}

	private _stopAutoScroll() {
		if (this._autoScrollRAF !== null && typeof cancelAnimationFrame !== 'undefined') {
			cancelAnimationFrame(this._autoScrollRAF);
		}
		this._autoScrollRAF = null;
		this._autoScrollEl = null;
		this._autoScrollVy = 0;
	}

	/** Resolve the row + owning controller under the pointer and light up its drop visuals. */
	private _updatePointerHover(el: Element | null, event: PointerEvent) {
		const ctx = this._resolveDropContext(el);
		const targetCtrl = ctx?.controller ?? this;
		const operation: DropOperation = this.isCopyAllowed && event.ctrlKey ? 'copy' : 'move';
		this.currentDropOperation = operation;

		// Cursor over a floating overlay button (floating dropZoneMode): the buttons sit OFF the
		// row, so elementFromPoint no longer resolves a node. Keep the existing hover alive (so the
		// buttons stay mounted) and just track which one is active for its highlight.
		const floatingZone = el?.closest('.stv__drop-zone') as HTMLElement | null;
		if (floatingZone && this._hoverCtrl) {
			this._hoverCtrl.floatingHoveredZone = floatingZone.classList.contains('stv__drop-zone--before')
				? 'before'
				: floatingZone.classList.contains('stv__drop-zone--after')
					? 'after'
					: 'child';
			return;
		}
		if (this._hoverCtrl) this._hoverCtrl.floatingHoveredZone = null;

		const modeOk =
			targetCtrl === this
				? this.isDropAllowedByMode(this.draggedNode?.treeId)
				: targetCtrl.dragDropMode === 'both' || targetCtrl.dragDropMode === 'cross';

		if (ctx?.node && ctx.node !== this.draggedNode && ctx.node.isDropAllowed && modeOk) {
			const rowEl = (el as Element).closest('.stv__node-content') as HTMLElement | null;
			const positions = targetCtrl.getNodeAllowedDropPositions(ctx.node);
			const position = rowEl
				? targetCtrl.calculateDropPositionFromEvent(event, rowEl, positions)
				: 'child';
			this._applyHover(targetCtrl, ctx.node, position, operation);
			// Floating dropZoneMode renders overlay buttons (position:fixed) sized to the row.
			if (targetCtrl.dropZoneMode === 'floating') {
				const row = (rowEl?.closest('.stv__node-row') ?? rowEl) as Element | null;
				if (row) {
					const r = row.getBoundingClientRect();
					targetCtrl.floatingZoneRect = { top: r.top, left: r.left, width: r.width, height: r.height };
				}
			}
			this.onNodeDragOverHandler?.({
				...targetCtrl.nodeRef(ctx.node),
				event,
				dragged: this._draggedRefs(this.draggedNode)
			});
		} else {
			this._clearHover();
			targetCtrl.isDropPlaceholderActive = !!el?.closest('.stv__empty-state');
		}
	}

	private _applyHover(
		ctrl: TreeController<any>,
		node: LTreeNode<any>,
		position: DropPosition,
		operation: DropOperation
	) {
		if (this._hoverCtrl && this._hoverCtrl !== ctrl) this._clearHoverCtrl(this._hoverCtrl);
		// A cross-tree target needs isDragInProgress on so its own Node.svelte renders the glow.
		if (ctrl !== this) ctrl.isDragInProgress = true;
		ctrl.hoveredNodeForDrop = node;
		ctrl.activeDropPosition = position;
		ctrl.currentDropOperation = operation;
		this._hoverCtrl = ctrl;
	}

	private _clearHoverCtrl(ctrl: TreeController<any>) {
		ctrl.hoveredNodeForDrop = null;
		ctrl.activeDropPosition = null;
		ctrl.isDropPlaceholderActive = false;
		ctrl.floatingZoneRect = null;
		ctrl.floatingHoveredZone = null;
		if (ctrl !== this) ctrl.isDragInProgress = false;
	}

	private _clearHover() {
		if (this._hoverCtrl) {
			this._clearHoverCtrl(this._hoverCtrl);
			this._hoverCtrl = null;
		}
		this.hoveredNodeForDrop = null;
		this.activeDropPosition = null;
	}

	private async _onPointerUp(event: PointerEvent) {
		if (this.touchTimer) {
			clearTimeout(this.touchTimer);
			this.touchTimer = null;
		}
		const st = this.touchDragState;

		if (st.isDragging && this.draggedNode) {
			if (st.ghostElement) st.ghostElement.style.display = 'none';

			const dropEl = document.elementFromPoint(event.clientX, event.clientY);
			const ctx = this._resolveDropContext(dropEl);
			const targetCtrl = ctx?.controller ?? this;
			const dropNode = ctx?.node ?? null;
			const dragged = this.draggedNode;

			const emptyZone = dropEl?.closest('.stv__empty-state');
			const rootZone = dropEl?.closest('.stv__root-drop-zone');
			const inTargetContainer = !!dropEl?.closest('.stv__container');
			// Floating dropZoneMode: the before/after/child overlay buttons sit over the hovered
			// row (position:fixed). A drop on one uses the owning tree's hovered node as target
			// and the button's position class.
			const floatingZone = dropEl?.closest('.stv__drop-zone') as HTMLElement | null;

			const modeOk =
				targetCtrl === this
					? this.isDropAllowedByMode(dragged.treeId)
					: targetCtrl.dragDropMode === 'both' || targetCtrl.dragDropMode === 'cross';

			if (floatingZone && targetCtrl.hoveredNodeForDrop && modeOk) {
				const pos: DropPosition = floatingZone.classList.contains('stv__drop-zone--before')
					? 'before'
					: floatingZone.classList.contains('stv__drop-zone--after')
						? 'after'
						: 'child';
				await targetCtrl._handleDrop(targetCtrl.hoveredNodeForDrop, dragged, pos, event);
			} else if (dropNode && dropNode !== dragged && dropNode.isDropAllowed && modeOk) {
				const rowEl = (dropEl as Element).closest('.stv__node-content') as HTMLElement | null;
				const positions = targetCtrl.getNodeAllowedDropPositions(dropNode);
				const position = rowEl
					? targetCtrl.calculateDropPositionFromEvent(event, rowEl, positions)
					: 'child';
				await targetCtrl._handleDrop(dropNode, dragged, position, event);
			} else if (targetCtrl.shouldEnableTreeDropZone && inTargetContainer && modeOk) {
				// Whole-tree drop zone: ANY release inside the container that didn't land as a valid
				// node drop — empty area, or a node whose getIsDropAllowedCallback rejected it —
				// lands with target=null so beforeDrop can fan it out via DropGroup[].
				await targetCtrl._handleDrop(null, dragged, 'child', event);
			} else if ((emptyZone || rootZone) && !dropNode && modeOk) {
				await targetCtrl._handleDrop(null, dragged, 'child', event);
			} else if (dropNode && dropNode !== dragged) {
				targetCtrl._indicateDropDenied(dropNode);
			}
		}

		this.removeGhostElement();
		this._resetPointerState();
	}

	private _onPointerCancel() {
		// Esc / pointercancel while dragging = abort. Nothing was mutated (commit-on-drop),
		// so just restore the highlight the grab replaced and tear down.
		if (this.touchDragState.isDragging) this._restorePreDragHighlight();
		this.removeGhostElement();
		this._resetPointerState();
	}

	/** Map an element under the pointer to its owning tree's controller + the node it belongs to. */
	private _resolveDropContext(
		el: Element | null
	): { controller: TreeController<any>; node: LTreeNode<any> | null } | null {
		if (!el) return null;
		const container = el.closest('.stv__container') as HTMLElement | null;
		const treeId = container?.getAttribute('data-tree-id') ?? null;
		const registered =
			treeId && treeId !== this.treeId
				? (getClipboardTree(treeId) as unknown as TreeController<any> | undefined)
				: undefined;
		const controller = registered ?? this;
		const nodeEl = el.closest('.stv__node');
		const path = nodeEl?.getAttribute('data-tree-path') ?? null;
		const node = path ? controller.tree.getNodeByPath(path) : null;
		return { controller, node };
	}

	private _addPointerListeners() {
		this._removePointerListeners();
		this._boundPointerMove = (e: PointerEvent) => this._onPointerMove(e);
		this._boundPointerUp = (e: PointerEvent) => void this._onPointerUp(e);
		this._boundPointerCancel = () => this._onPointerCancel();
		this._boundPointerKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') this._onPointerCancel();
		};
		window.addEventListener('pointermove', this._boundPointerMove, { passive: false });
		window.addEventListener('pointerup', this._boundPointerUp);
		window.addEventListener('pointercancel', this._boundPointerCancel);
		window.addEventListener('keydown', this._boundPointerKeydown);
	}

	private _removePointerListeners() {
		if (typeof window === 'undefined') return;
		if (this._boundPointerMove) {
			window.removeEventListener('pointermove', this._boundPointerMove);
			this._boundPointerMove = null;
		}
		if (this._boundPointerUp) {
			window.removeEventListener('pointerup', this._boundPointerUp);
			this._boundPointerUp = null;
		}
		if (this._boundPointerCancel) {
			window.removeEventListener('pointercancel', this._boundPointerCancel);
			this._boundPointerCancel = null;
		}
		if (this._boundPointerKeydown) {
			window.removeEventListener('keydown', this._boundPointerKeydown);
			this._boundPointerKeydown = null;
		}
	}

	private _resetPointerState() {
		this._removePointerListeners();
		this._stopAutoScroll();
		this._clearDragDenied();
		this._clearHover();
		this._lastPointerEvent = null;
		if (this.touchTimer) {
			clearTimeout(this.touchTimer);
			this.touchTimer = null;
		}
		this.touchDragState = {
			node: null,
			startX: 0,
			startY: 0,
			isDragging: false,
			isDenied: false,
			ghostElement: null,
			currentDropTarget: null
		};
		this.draggedNode = null;
		this.isDragInProgress = false;
		this.isDropPlaceholderActive = false;
		this.hoveredNodeForDrop = null;
		this.activeDropPosition = null;
		this._dragSetOverride = null;
		this._preDragHighlightSnapshot = null;
		clearDragSet();
	}

	/**
	 * "Can't move this" feedback for a long-press on a NON-draggable node. Fires the
	 * onNodeDragDenied consumer hook always; the built-in indicator (haptic double-buzz +
	 * a no-entry icon that STAYS on the row while the finger is held) only when
	 * shouldIndicateUndraggable is on. Purely imperative DOM (mirrors the touch drop-target
	 * highlight) — no per-node render state. Torn down by _clearDragDenied on release.
	 */
	private _indicateDragDenied(node: LTreeNode<any>) {
		dragLogger.debug('[drag-denied] locked node long-pressed', { path: node?.path });

		this.onNodeDragDeniedHandler?.(this.nodeRef(node));

		if (!this.shouldIndicateUndraggable) return;

		// Distinct double-buzz (a real drag start is a single 50ms buzz).
		try {
			navigator.vibrate?.([30, 25, 30]);
		} catch {
			/* blocked by browser policy */
		}

		if (typeof document === 'undefined') return;
		const el = document.querySelector(
			`[data-tree-path="${node.path}"] .stv__node-content`
		) as HTMLElement | null;
		if (!el) return;

		// Clear any previous indicator, then show one that persists until release.
		this._clearDragDenied();

		el.classList.add('stv__node-content--drag-denied');
		this._deniedRowEl = el;

		const badge = document.createElement('span');
		badge.className = 'stv__drag-denied-badge';
		badge.textContent = '🚫';
		badge.setAttribute('aria-hidden', 'true');
		el.appendChild(badge);
		this._deniedBadgeEl = badge;
	}

	/** Remove the held "can't move this" indicator (badge + row class). Idempotent. */
	private _clearDragDenied() {
		if (this._deniedBadgeEl) {
			this._deniedBadgeEl.remove();
			this._deniedBadgeEl = null;
		}
		if (this._deniedRowEl) {
			this._deniedRowEl.classList.remove('stv__node-content--drag-denied');
			this._deniedRowEl = null;
		}
	}

	/**
	 * "Can't drop here" feedback — the target-side twin of _indicateDragDenied. Fires the
	 * onNodeDropDenied consumer hook always; the built-in indicator (haptic + a brief no-entry
	 * flash on the refusing target) only when shouldIndicateUndraggable is on. Transient (a drop
	 * is a discrete moment, not a held gesture), so it auto-clears after a short beat.
	 */
	private _indicateDropDenied(node: LTreeNode<any>) {
		dragLogger.debug('[drop-denied] target refused drop', { path: node?.path });

		this.onNodeDropDeniedHandler?.(this.nodeRef(node));

		if (!this.shouldIndicateUndraggable) return;

		try {
			navigator.vibrate?.([30, 25, 30]);
		} catch {
			/* blocked by browser policy */
		}

		if (typeof document === 'undefined') return;
		const el = document.querySelector(
			`[data-tree-path="${node.path}"] .stv__node-content`
		) as HTMLElement | null;
		if (!el) return;

		el.classList.add('stv__node-content--drag-denied');
		const badge = document.createElement('span');
		badge.className = 'stv__drag-denied-badge';
		badge.textContent = '🚫';
		badge.setAttribute('aria-hidden', 'true');
		el.appendChild(badge);

		setTimeout(() => {
			el.classList.remove('stv__node-content--drag-denied');
			badge.remove();
		}, 700);
	}

	private createGhostElement(node: LTreeNode<any>, x: number, y: number) {
		// Remove any stale ghost elements (e.g. from interrupted drags)
		this.removeGhostElement();
		document.querySelectorAll('.stv__touch-ghost').forEach((el) => el.remove());

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
		this._removePointerListeners();
		this.removeGhostElement();
		// Remove any orphaned ghosts from document body
		document.querySelectorAll('.stv__touch-ghost').forEach((el) => el.remove());
	}

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
	navTo(path: string): void {
		this.navigation.navTo(path);
	}
	/** Move to next visible node at the same level */
	navNextSibling(): void {
		this.navigation.navNextSibling();
	}
	/** Move to previous visible node at the same level */
	navPrevSibling(): void {
		this.navigation.navPrevSibling();
	}
	/** Move to first child (expands if collapsed) */
	navInto(): void {
		this.navigation.navInto();
	}
	/** Move to parent node (no collapse) */
	navOut(): void {
		this.navigation.navOut();
	}
	/** Collapse parent and select it (Backspace behavior) */
	navBackOut(): void {
		this.navigation.navBackOut();
	}
	/** Toggle expand/collapse of current node */
	navToggle(): void {
		this.navigation.navToggle();
	}
	/** Select first visible node */
	navFirst(): void {
		this.navigation.navFirst();
	}
	/** Select last visible node */
	navLast(): void {
		this.navigation.navLast();
	}
	/** PageDown — jump forward ~10 visible nodes */
	navPageDown(): void {
		this.navigation.navPageDown();
	}
	/** PageUp — jump back ~10 visible nodes */
	navPageUp(): void {
		this.navigation.navPageUp();
	}

	// ── Shift+navigation: extend highlight range ────────────────────
	/** Shift+ArrowDown — extend highlight to next visible node */
	navHighlightNext(): void {
		this.navigation.navHighlightNext();
	}
	/** Shift+ArrowUp — extend highlight to previous visible node */
	navHighlightPrev(): void {
		this.navigation.navHighlightPrev();
	}
	/** Shift+Home — extend highlight to first visible node */
	navHighlightFirst(): void {
		this.navigation.navHighlightFirst();
	}
	/** Shift+End — extend highlight to last visible node */
	navHighlightLast(): void {
		this.navigation.navHighlightLast();
	}
	/** Shift+PageDown — extend highlight forward ~10 visible nodes */
	navHighlightPageDown(): void {
		this.navigation.navHighlightPageDown();
	}
	/** Shift+PageUp — extend highlight back ~10 visible nodes */
	navHighlightPageUp(): void {
		this.navigation.navHighlightPageUp();
	}

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
				const currentIndex = currentPath ? flatNodes.findIndex((n) => n.path === currentPath) : -1;
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
				const currentIndex = currentPath ? flatNodes.findIndex((n) => n.path === currentPath) : -1;
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
				const currentIndex = flatNodes.findIndex((n) => n.path === currentPath);

				if (node.hasChildren && !node.isExpanded && node.isCollapsible !== false) {
					this.expandNodes(currentPath);
					tick().then(() => {
						const updatedFlat = this.allFlatNodes;
						const idx = updatedFlat.findIndex((n) => n.path === currentPath);
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
				const currentIndex = currentPath ? flatNodes.findIndex((n) => n.path === currentPath) : -1;
				const targetIndex = Math.min(
					(currentIndex === -1 ? 0 : currentIndex) + 10,
					flatNodes.length - 1
				);
				this.navigation.navTo(flatNodes[targetIndex].path);
			},

			navPageUp: () => {
				const flatNodes = this.allFlatNodes;
				if (flatNodes.length === 0) return;
				const currentPath = this.focusedNode?.path;
				const currentIndex = currentPath
					? flatNodes.findIndex((n) => n.path === currentPath)
					: flatNodes.length;
				const targetIndex = Math.max(
					(currentIndex === -1 ? flatNodes.length : currentIndex) - 10,
					0
				);
				this.navigation.navTo(flatNodes[targetIndex].path);
			},

			// ── Shift+navigation: extend highlight range ────────────
			navHighlightNext: () => {
				const flatNodes = this.allFlatNodes;
				if (flatNodes.length === 0) return;
				const currentPath = this.focusedNode?.path;
				const currentIndex = currentPath ? flatNodes.findIndex((n) => n.path === currentPath) : -1;
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
				const currentIndex = currentPath ? flatNodes.findIndex((n) => n.path === currentPath) : -1;
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
				const currentIndex = currentPath ? flatNodes.findIndex((n) => n.path === currentPath) : -1;
				if (currentIndex === -1) return;
				const targetIndex = Math.min(currentIndex + 10, flatNodes.length - 1);
				this._navHighlightTo(flatNodes[targetIndex].path);
			},

			navHighlightPageUp: () => {
				const flatNodes = this.allFlatNodes;
				if (flatNodes.length === 0) return;
				const currentPath = this.focusedNode?.path;
				const currentIndex = currentPath ? flatNodes.findIndex((n) => n.path === currentPath) : -1;
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
