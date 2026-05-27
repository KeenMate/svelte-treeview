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
	type CheckboxMode
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
	getClipboardOperation as getClipboardOp
} from './clipboard.js';
import type { TreeNavigation } from './navigation.js';

// Re-register global API (safe to import multiple times)
import '../global-api.js';

// ─── Paste result type ────────────────────────────────────────────────────

export interface PasteResult<T> {
	success: boolean;
	count: number;
	error?: string;
	/** Included when autoHandlePaste=false — clipboard data for consumer to handle */
	entries?: ClipboardEntry<T>[];
	operation?: 'copy' | 'cut';
	targetPath?: string;
	position?: 'child' | 'before' | 'after';
}

// ─── Shared interfaces (also used by Node.svelte) ────────────────────────

export interface SelectionModifiers {
	ctrl: boolean;
	shift: boolean;
}

export interface NodeCallbacks<T> {
	onNodeClicked: (node: LTreeNode<T>, modifiers?: SelectionModifiers) => void;
	onCheckboxToggle: (node: LTreeNode<T>) => void;
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
	showCheckboxes: boolean;
	checkboxMode: CheckboxMode;
	expandIconClass: string;
	collapseIconClass: string;
	leafIconClass: string;
	toggleIconMode: ToggleIconMode;
	highlightedNodeClass: string | null | undefined;
	focusedNodeClass: string | null | undefined;
	dragOverNodeClass: string | null | undefined;
	dropZoneMode: 'floating' | 'glow';
	dropZoneLayout: 'around' | 'above' | 'below' | 'wave' | 'wave2';
	dropZoneStart: number | string;
	dropZoneMaxWidth: number;
	allowCopy: boolean;
	accordionExpand: boolean;
}

// ─── Controller props ─────────────────────────────────────────────────────

export interface TreeControllerProps<T> {
	// MAPPINGS
	idMember: string;
	pathMember: string;
	parentPathMember?: string | null | undefined;
	levelMember?: string | null | undefined;
	isExpandedMember?: string | null | undefined;
	isSelectableMember?: string | null | undefined;
	isSelectedMember?: string | null | undefined;
	isDraggableMember?: string | null | undefined;
	getIsDraggableCallback?: (node: LTreeNode<T>) => boolean;
	isDropAllowedMember?: string | null | undefined;
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
	showCheckboxes?: boolean | null | undefined;
	checkboxMode?: CheckboxMode | null | undefined;
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
	progressiveRender?: boolean;
	initialBatchSize?: number;
	maxBatchSize?: number;
	onRenderStart?: () => void;
	onRenderProgress?: (stats: RenderStats) => void;
	onRenderComplete?: (stats: RenderStats) => void;

	// Flat rendering
	useFlatRendering?: boolean;

	// Virtual scrolling (flat mode only)
	/** Enable virtual scrolling in flat mode. Only visible nodes + overscan are rendered. */
	virtualScroll?: boolean;
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
	allowCopy?: boolean;
	autoHandleCopy?: boolean;
	autoHandleMove?: boolean;
	autoHandlePaste?: boolean;
	accordionExpand?: boolean;

	// EVENTS (on* = fire-and-forget notifications)
	onNodeClick?: (node: LTreeNode<T>) => void;
	onNodeDragStart?: (node: LTreeNode<T>, event: DragEvent) => void;
	onNodeDragOver?: (node: LTreeNode<T>, event: DragEvent) => void;
	onNodeDrop?: (
		dropNode: LTreeNode<T> | null,
		draggedNode: LTreeNode<T>,
		position: DropPosition,
		event: DragEvent | TouchEvent,
		operation: DropOperation
	) => void;
	onHighlightChange?: (paths: Set<string>, nodes: LTreeNode<T>[]) => void;
	onSelectionChange?: (paths: Set<string>, nodes: LTreeNode<T>[]) => void;
	onPaste?: (result: PasteResult<T>) => void;

	// INTERCEPTORS (before*Callback = can modify/block)
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
	beforeCopyCallback?: (paths: string[]) => string[] | false | void;
	beforeCutCallback?: (paths: string[]) => string[] | false | void;
	beforePasteCallback?: (
		targetPath: string,
		operation: 'copy' | 'cut',
		entries: ClipboardEntry<T>[]
	) => { targetPath?: string; position?: 'child' | 'before' | 'after' } | false | void;

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
		showCheckboxes: false,
		checkboxMode: 'independent',
		expandIconClass: 'ltree-icon-expand',
		collapseIconClass: 'ltree-icon-collapse',
		leafIconClass: 'ltree-icon-leaf',
		highlightedNodeClass: undefined,
		focusedNodeClass: undefined,
		dragOverNodeClass: undefined,
		dropZoneMode: 'glow',
		dropZoneLayout: 'around',
		dropZoneStart: 33,
		toggleIconMode: 'rotate',
		dropZoneMaxWidth: 120,
		allowCopy: false,
		accordionExpand: false
	});

	// ── Props stored as reactive state ──────────────────────────────────
	treeId = $state<string>('');
	treePathSeparator = $state<string>('.');

	// DATA (bidirectional / output)
	data = $state.raw<T[]>([]);
	focusedNode = $state.raw<LTreeNode<T> | null | undefined>(null);
	highlightedPaths = $state.raw<Set<string>>(new Set());
	lastHighlightedPath: string | null = null;
	selectedPaths = $state.raw<Set<string>>(new Set());
	insertResult = $state.raw<InsertArrayResult<T> | null | undefined>(null);
	searchText = $state<string | null | undefined>(undefined);
	isRendering = $state(false);

	// BEHAVIOUR
	shouldDisplayDebugInformation = $state(false);
	shouldDisplayContextMenuInDebugMode = $state(false);
	rangeSelectionMode = $state<'visual' | 'logical'>('visual');
	isLoading = $state(false);
	useFlatRendering = $state(true);
	progressiveRender = $state(true);
	initialBatchSize = $state(20);
	maxBatchSize = $state(500);
	bodyClass = $state<string | null | undefined>(undefined);

	// DRAG AND DROP
	dragDropMode = $state<DragDropMode>('none');
	allowCopy = $state(false);
	accordionExpand = $state(false);
	autoHandleCopy = $state(true);
	autoHandleMove = $state(true);
	autoHandlePaste = $state(true);

	// Event handlers (on* = fire-and-forget)
	onNodeClickHandler: ((node: LTreeNode<T>) => void) | undefined;
	onHighlightChangeHandler: ((paths: Set<string>, nodes: LTreeNode<T>[]) => void) | undefined;
	onSelectionChangeHandler: ((paths: Set<string>, nodes: LTreeNode<T>[]) => void) | undefined;
	onNodeDragStartHandler: ((node: LTreeNode<T>, event: DragEvent) => void) | undefined;
	onNodeDragOverHandler: ((node: LTreeNode<T>, event: DragEvent) => void) | undefined;
	onNodeDropHandler: TreeControllerProps<T>['onNodeDrop'];
	onPasteHandler: ((result: PasteResult<T>) => void) | undefined;
	onRenderStartHandler: (() => void) | undefined;
	onRenderProgressHandler: ((stats: RenderStats) => void) | undefined;
	onRenderCompleteHandler: ((stats: RenderStats) => void) | undefined;

	// Interceptor handlers (before*Callback)
	beforeDropHandler: TreeControllerProps<T>['beforeDropCallback'];
	beforeCopyHandler: TreeControllerProps<T>['beforeCopyCallback'];
	beforeCutHandler: TreeControllerProps<T>['beforeCutCallback'];
	beforePasteHandler: TreeControllerProps<T>['beforePasteCallback'];
	beforeCheckboxToggleHandler: TreeControllerProps<T>['beforeCheckboxToggleCallback'];

	// Data provider handlers (get*Callback)
	getContextMenuItemsHandler: TreeControllerProps<T>['getContextMenuItemsCallback'];

	// Visual config (for nodeConfig updates)
	clickBehavior = $state<ClickBehavior>('expand-and-focus');
	showCheckboxes = $state(false);
	checkboxMode = $state<CheckboxMode>('independent');
	expandIconClass = $state('ltree-icon-expand');
	collapseIconClass = $state('ltree-icon-collapse');
	leafIconClass = $state('ltree-icon-leaf');
	toggleIconMode = $state<ToggleIconMode>('rotate');
	highlightedNodeClass = $state<string | null | undefined>(undefined);
	focusedNodeClass = $state<string | null | undefined>(undefined);
	dragOverNodeClass = $state<string | null | undefined>(undefined);
	dropZoneMode = $state<'floating' | 'glow'>('glow');
	dropZoneLayout = $state<'around' | 'above' | 'below' | 'wave' | 'wave2'>('around');
	dropZoneStart = $state<number | string>(33);
	dropZoneMaxWidth = $state(120);
	scrollHighlightTimeout = $state(4000);
	scrollHighlightClass = $state<string | null | undefined>('ltree-scroll-highlight');
	contextMenuXOffset = $state(8);
	contextMenuYOffset = $state(0);

	hasContextMenuSnippet = $state(false);

	// Virtual scrolling
	virtualScroll = $state(false);
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
	vsActive = $derived(this.virtualScroll && this.useFlatRendering);
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
			: this.useFlatRendering && this.progressiveRender
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

		this.data = props.data;
		this.focusedNode = props.focusedNode ?? null;
		this.highlightedPaths = props.highlightedPaths ?? new Set();
		this.selectedPaths = props.selectedPaths ?? new Set();
		this.searchText = props.searchText;

		this.shouldDisplayDebugInformation = props.shouldDisplayDebugInformation ?? false;
		this.shouldDisplayContextMenuInDebugMode = props.shouldDisplayContextMenuInDebugMode ?? false;
		this.rangeSelectionMode = props.rangeSelectionMode ?? 'visual';
		this.isLoading = props.isLoading ?? false;

		this.useFlatRendering = props.useFlatRendering ?? true;
		this.progressiveRender = props.progressiveRender ?? true;
		this.initialBatchSize = props.initialBatchSize ?? 20;
		this.maxBatchSize = props.maxBatchSize ?? 500;
		this.bodyClass = props.bodyClass;

		this.dragDropMode = props.dragDropMode ?? 'none';
		this.allowCopy = props.allowCopy ?? false;
		this.autoHandleCopy = props.autoHandleCopy ?? true;
		this.autoHandleMove = props.autoHandleMove ?? true;
		this.autoHandlePaste = props.autoHandlePaste ?? true;
		this.accordionExpand = props.accordionExpand ?? false;

		this.clickBehavior = props.clickBehavior ?? 'expand-and-focus';
		this.showCheckboxes = props.showCheckboxes ?? false;
		this.checkboxMode = props.checkboxMode ?? 'independent';
		this.beforeCheckboxToggleHandler = props.beforeCheckboxToggleCallback;
		this.expandIconClass = props.expandIconClass ?? 'ltree-icon-expand';
		this.collapseIconClass = props.collapseIconClass ?? 'ltree-icon-collapse';
		this.leafIconClass = props.leafIconClass ?? 'ltree-icon-leaf';
		this.toggleIconMode = props.toggleIconMode ?? 'rotate';
		this.highlightedNodeClass = props.highlightedNodeClass;
		this.focusedNodeClass = props.focusedNodeClass;
		this.dragOverNodeClass = props.dragOverNodeClass;
		this.dropZoneMode = props.dropZoneMode ?? 'glow';
		this.dropZoneLayout = props.dropZoneLayout ?? 'around';
		this.dropZoneStart = props.dropZoneStart ?? 33;
		this.dropZoneMaxWidth = props.dropZoneMaxWidth ?? 120;
		this.scrollHighlightTimeout = props.scrollHighlightTimeout ?? 4000;
		this.scrollHighlightClass = props.scrollHighlightClass ?? 'ltree-scroll-highlight';
		this.contextMenuXOffset = props.contextMenuXOffset ?? 8;
		this.contextMenuYOffset = props.contextMenuYOffset ?? 0;
		this.hasContextMenuSnippet = props.hasContextMenuSnippet ?? false;

		// Virtual scrolling
		this.virtualScroll = props.virtualScroll ?? false;
		this.virtualRowHeight = props.virtualRowHeight;
		this.virtualOverscan = props.virtualOverscan ?? 5;
		this.virtualContainerHeight = props.virtualContainerHeight;

		// Store callbacks
		this.onNodeClickHandler = props.onNodeClick;
		this.onHighlightChangeHandler = props.onHighlightChange;
		this.onSelectionChangeHandler = props.onSelectionChange;
		this.onNodeDragStartHandler = props.onNodeDragStart;
		this.onNodeDragOverHandler = props.onNodeDragOver;
		this.onNodeDropHandler = props.onNodeDrop;
		this.onPasteHandler = props.onPaste;
		this.beforeDropHandler = props.beforeDropCallback;
		this.beforeCopyHandler = props.beforeCopyCallback;
		this.beforeCutHandler = props.beforeCutCallback;
		this.beforePasteHandler = props.beforePasteCallback;
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
			props.isSelectableMember,
			props.isSelectedMember,
			props.isDraggableMember,
			props.getIsDraggableCallback,
			props.isDropAllowedMember,
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
		this.renderCoordinator = this.progressiveRender
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
			onNodeClicked: (node: LTreeNode<T>, modifiers?: SelectionModifiers) => this._onNodeClicked(node, modifiers),
			onCheckboxToggle: (node: LTreeNode<T>) => this._onCheckboxToggle(node),
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
			showCheckboxes: this.showCheckboxes,
			checkboxMode: this.checkboxMode,
			expandIconClass: this.expandIconClass,
			collapseIconClass: this.collapseIconClass,
			leafIconClass: this.leafIconClass,
			toggleIconMode: this.toggleIconMode,
			highlightedNodeClass: this.highlightedNodeClass,
			focusedNodeClass: this.focusedNodeClass,
			dragOverNodeClass: this.dragOverNodeClass,
			dropZoneMode: this.dropZoneMode,
			dropZoneLayout: this.dropZoneLayout,
			dropZoneStart: this.dropZoneStart,
			dropZoneMaxWidth: this.dropZoneMaxWidth,
			allowCopy: this.allowCopy,
			accordionExpand: this.accordionExpand
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
				showCheckboxes: this.showCheckboxes,
				expandIconClass: this.expandIconClass,
				collapseIconClass: this.collapseIconClass,
				leafIconClass: this.leafIconClass,
				toggleIconMode: this.toggleIconMode,
				highlightedNodeClass: this.highlightedNodeClass,
				focusedNodeClass: this.focusedNodeClass,
				dragOverNodeClass: this.dragOverNodeClass,
				dropZoneMode: this.dropZoneMode,
				dropZoneLayout: this.dropZoneLayout,
				dropZoneStart: this.dropZoneStart,
				dropZoneMaxWidth: this.dropZoneMaxWidth,
				allowCopy: this.allowCopy,
				accordionExpand: this.accordionExpand
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
				if (this.tree.isSelectedMember) {
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
			if (!this.useFlatRendering || !this.progressiveRender || !this.tree?.visibleFlatNodes)
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
					const firstNode = this.vsContainerRef.querySelector('.ltree-node');
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

		// Context menu global event listeners
		$effect(() => {
			if (this.contextMenuVisible) {
				const handleGlobalClick = (event: MouseEvent) => {
					const target = event.target as Element;
					if (!target.closest('.ltree-context-menu')) {
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

	async expandNodes(nodePath: string) {
		this.tree.expandNodes(nodePath);
	}

	async collapseNodes(nodePath: string) {
		this.tree.collapseNodes(nodePath);
	}

	expandAll(nodePath?: string | null | undefined) {
		this.tree?.expandAll(nodePath);
	}

	collapseAll(nodePath?: string | null | undefined) {
		this.tree?.collapseAll(nodePath);
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
		const result = this.tree?.moveNode(sourcePath, targetPath, position) || {
			success: false,
			error: 'Tree not initialized'
		};
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
	private _collectClipboardEntry(node: LTreeNode<T>): ClipboardEntry<T> {
		const descendants: ClipboardEntry<T>['descendants'] = [];
		const sep = this.treePathSeparator;

		const walk = (n: LTreeNode<T>) => {
			for (const child of Object.values(n.children)) {
				// relativePath = everything after sourcePath + separator
				const rel = child.path.substring(node.path.length);
				descendants.push({
					relativePath: rel,
					data: structuredClone(child.data as T)
				});
				walk(child);
			}
		};
		walk(node);

		return {
			sourceTreeId: this.treeId,
			sourcePath: node.path,
			data: structuredClone(node.data as T),
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
			const result = this.beforeCopyHandler(pathsToUse);
			if (result === false) return;
			if (Array.isArray(result)) pathsToUse = result;
		}

		const entries: ClipboardEntry<T>[] = [];
		for (const p of pathsToUse) {
			const node = this.tree.getNodeByPath(p);
			if (node) entries.push(this._collectClipboardEntry(node));
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
			const result = this.beforeCutHandler(pathsToUse);
			if (result === false) return;
			if (Array.isArray(result)) pathsToUse = result;
		}

		const entries: ClipboardEntry<T>[] = [];
		const cutSet = new Set<string>();
		for (const p of pathsToUse) {
			const node = this.tree.getNodeByPath(p);
			if (node) {
				entries.push(this._collectClipboardEntry(node));
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
	}

	/**
	 * Paste clipboard content under (or beside) the target node.
	 * @param targetPath Where to paste
	 * @param transformData Consumer callback to generate new IDs/paths for pasted data
	 * @param position 'child' (default), 'before', or 'after'
	 */
	pasteNodes(
		targetPath: string,
		transformData: (data: T, index: number, operation: 'copy' | 'cut') => T,
		position: 'child' | 'before' | 'after' = 'child'
	): PasteResult<T> {
		const clip = getClipboard<T>();
		if (!clip || clip.entries.length === 0) {
			return { success: false, count: 0, error: 'Clipboard is empty' };
		}

		// Interceptor: can modify target/position or block
		if (this.beforePasteHandler) {
			const result = this.beforePasteHandler(targetPath, clip.operation, clip.entries);
			if (result === false) {
				return { success: false, count: 0, error: 'Paste blocked by beforePasteCallback' };
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
			return { success: false, count: 0, error: `Target node not found: ${targetPath}` };
		}

		// Guard: reject pasting into the source node or any of its descendants (same-tree)
		if (!isRootPasteAfter && clip.sourceTreeId === this.treeId) {
			const sep = this.treePathSeparator;
			for (const entry of clip.entries) {
				if (targetPath === entry.sourcePath || targetPath.startsWith(entry.sourcePath + sep)) {
					return { success: false, count: 0, error: 'Cannot paste a node into itself or its own descendant' };
				}
			}
		}

		// When autoHandlePaste=false, don't modify tree — just provide clipboard data
		if (!this.autoHandlePaste) {
			const result: PasteResult<T> = {
				success: true,
				count: clip.entries.length,
				entries: clip.entries,
				operation: clip.operation,
				targetPath,
				position
			};

			// Clear clipboard and cut state
			this.cutPaths = new Set();
			clearClipboard();

			uiLogger.debug(`[clipboard] autoHandlePaste=false — forwarding ${clip.entries.length} entries to consumer`);
			this.onPasteHandler?.(result);
			return result;
		}

		this._skipInsertArray = true;
		let totalCount = 0;
		let lastError: string | undefined;

		for (const entry of clip.entries) {
			// Always reconstruct from clipboard data snapshot (avoids infinite loop
			// when copyNodeWithDescendants iterates live children while adding to them)
			const transformedRoot = transformData(entry.data, totalCount, clip.operation);
			let addResult: { success: boolean; node?: LTreeNode<T>; error?: string };
			if (isRootPasteAfter || position === 'child') {
				// Root paste or child: add under targetPath ('' for root)
				addResult = this.tree.addNode(targetPath, transformedRoot);
			} else {
				addResult = this.tree.addNode(targetNodeAfter!.parentPath ?? '', transformedRoot);
			}
			if (addResult.success && addResult.node) {
				totalCount++;
				// Add descendants from the snapshot taken at copy/cut time
				for (const desc of entry.descendants) {
					const transformedDesc = transformData(desc.data, totalCount, clip.operation);
					const parentRelPath = desc.relativePath.substring(0, desc.relativePath.lastIndexOf(this.treePathSeparator));
					const descParentPath = parentRelPath
						? addResult.node.path + parentRelPath
						: addResult.node.path;
					const descResult = this.tree.addNode(descParentPath, transformedDesc);
					if (descResult.success) totalCount++;
				}
			} else {
				lastError = addResult.error;
			}
		}

		// If cut operation AND same tree, remove source nodes
		if (clip.operation === 'cut' && clip.sourceTreeId === this.treeId) {
			for (const entry of clip.entries) {
				this.tree.removeNode(entry.sourcePath, true);
			}
		}

		tick().then(() => {
			this._skipInsertArray = false;
		});

		// Clear clipboard and cut state
		this.cutPaths = new Set();
		clearClipboard();

		const result: PasteResult<T> = {
			success: totalCount > 0,
			count: totalCount,
			error: totalCount === 0 ? (lastError ?? 'No nodes pasted') : undefined
		};
		uiLogger.debug(`[clipboard] Pasted ${totalCount} node(s)`);
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
		event.dataTransfer.effectAllowed = this.allowCopy ? 'copyMove' : 'move';
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

		const isValidDrop = effectiveDraggedNode
			? isCrossTreeDrag || effectiveDraggedNode.path !== node.path
			: this.isDragInProgress;

		if (!isValidDrop) {
			dragLogger.debug('dragOver REJECTED - invalid drop (same node?)', { path: node.path, draggedPath: effectiveDraggedNode?.path });
			return;
		}

		event.preventDefault();
		this.hoveredNodeForDrop = node;
		this.currentDropOperation = (this.allowCopy && event.ctrlKey) ? 'copy' : 'move';

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
		this.onNodeDragOverHandler?.(node, event);
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
			event.dataTransfer.dropEffect = (this.allowCopy && event.ctrlKey) ? 'copy' : 'move';
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
			dragLogger.debug('drop check', { dropAllowed, isCrossTreeDrag, sameNode, draggedPath: this.draggedNode.path, targetPath: node.path, dragDropMode: this.dragDropMode });

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
		return this.tree?.getNodeIsDraggable(node) ?? true;
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
		const element = rootEl
			? rootEl.querySelector(`#${CSS.escape(elementId)}`)
			: document.getElementById(elementId);
		const contentDiv = element?.querySelector('.ltree-node-content') as HTMLElement | null;

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
		const contentDiv = element?.querySelector('.ltree-node-content') as HTMLElement | null;

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

		if (updates.virtualScroll !== undefined) this.virtualScroll = updates.virtualScroll ?? false;
		if (updates.virtualRowHeight !== undefined) this.virtualRowHeight = updates.virtualRowHeight;
		if (updates.virtualOverscan !== undefined) this.virtualOverscan = updates.virtualOverscan ?? 5;
		if (updates.virtualContainerHeight !== undefined) this.virtualContainerHeight = updates.virtualContainerHeight;

		if (updates.clickBehavior !== undefined)
			this.clickBehavior = updates.clickBehavior ?? 'expand-and-focus';
		if (updates.showCheckboxes !== undefined)
			this.showCheckboxes = updates.showCheckboxes ?? false;
		if (updates.checkboxMode !== undefined)
			this.checkboxMode = updates.checkboxMode ?? 'independent';
		if (updates.beforeCheckboxToggleCallback !== undefined)
			this.beforeCheckboxToggleHandler = updates.beforeCheckboxToggleCallback;
		if (updates.expandIconClass !== undefined)
			this.expandIconClass = updates.expandIconClass ?? 'ltree-icon-expand';
		if (updates.collapseIconClass !== undefined)
			this.collapseIconClass = updates.collapseIconClass ?? 'ltree-icon-collapse';
		if (updates.leafIconClass !== undefined)
			this.leafIconClass = updates.leafIconClass ?? 'ltree-icon-leaf';
		if (updates.highlightedNodeClass !== undefined)
			this.highlightedNodeClass = updates.highlightedNodeClass;
		if (updates.focusedNodeClass !== undefined)
			this.focusedNodeClass = updates.focusedNodeClass;
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
		if (updates.allowCopy !== undefined) this.allowCopy = updates.allowCopy ?? false;
		if (updates.autoHandleCopy !== undefined)
			this.autoHandleCopy = updates.autoHandleCopy ?? true;
		if (updates.autoHandleMove !== undefined)
			this.autoHandleMove = updates.autoHandleMove ?? true;
		if (updates.autoHandlePaste !== undefined)
			this.autoHandlePaste = updates.autoHandlePaste ?? true;
		if (updates.dragDropMode !== undefined)
			this.dragDropMode = updates.dragDropMode ?? 'none';
		if (updates.scrollHighlightTimeout !== undefined)
			this.scrollHighlightTimeout = updates.scrollHighlightTimeout ?? 4000;
		if (updates.scrollHighlightClass !== undefined)
			this.scrollHighlightClass = updates.scrollHighlightClass ?? 'ltree-scroll-highlight';
		if (updates.contextMenuXOffset !== undefined)
			this.contextMenuXOffset = updates.contextMenuXOffset ?? 8;
		if (updates.contextMenuYOffset !== undefined)
			this.contextMenuYOffset = updates.contextMenuYOffset ?? 0;

		// Callbacks
		if (updates.onNodeClick !== undefined) this.onNodeClickHandler = updates.onNodeClick;
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
		if (updates.onNodeDrop !== undefined) this.onNodeDropHandler = updates.onNodeDrop;
		if (updates.onPaste !== undefined) this.onPasteHandler = updates.onPaste;
		if (updates.getContextMenuItemsCallback !== undefined)
			this.getContextMenuItemsHandler = updates.getContextMenuItemsCallback;
		if (updates.onHighlightChange !== undefined)
			this.onHighlightChangeHandler = updates.onHighlightChange;
		if (updates.onSelectionChange !== undefined)
			this.onSelectionChangeHandler = updates.onSelectionChange;
	}

	// ── Internal event handlers ─────────────────────────────────────────

	private async _onNodeClicked(node: LTreeNode<T>, modifiers?: SelectionModifiers, options?: { silent?: boolean }) {
		if (this.contextMenuVisible) {
			this.closeContextMenu();
		}

		const ctrl = modifiers?.ctrl ?? false;
		const shift = modifiers?.shift ?? false;
		const silent = options?.silent ?? false;

		uiLogger.debug(`[highlight] Click on ${node.path}`, { ctrl, shift, lastAnchor: this.lastHighlightedPath, prevCount: this.highlightedPaths.size });

		if (ctrl) {
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
			this.lastHighlightedPath = node.path;
		} else if (shift && this.lastHighlightedPath) {
			// Range highlight from lastHighlightedPath to this node
			const rangePaths = this._getNodesBetween(this.lastHighlightedPath, node.path);
			// Clear previous highlights
			this._clearAllHighlightFlags();
			const newPaths = new Set<string>();
			for (const path of rangePaths) {
				newPaths.add(path);
				const n = this.tree.getNodeByPath(path);
				if (n) {
					n.isHighlighted = true;
					n._rev = (n._rev || 0) + 1;
				}
			}
			this.highlightedPaths = newPaths;
			// Don't update lastHighlightedPath on shift+click (anchor stays)
		} else {
			// Normal click: clear all highlights, highlight only this node
			this._clearAllHighlightFlags();
			node.isHighlighted = true;
			node._rev = (node._rev || 0) + 1;
			const newPaths = new Set<string>();
			newPaths.add(node.path);
			this.highlightedPaths = newPaths;
			this.lastHighlightedPath = node.path;
		}

		// Update focus
		this._setFocusedNode(node);

		if (!silent) {
			this.onNodeClickHandler?.(node);
			this._notifyHighlightChanged();
		}
		this.tree.refresh();

		// Focus the tree container so keyboard navigation works after clicking a node.
		// Skip in silent mode — programmatic highlight (e.g. from URL params) shouldn't
		// steal focus from whatever the user is currently interacting with.
		if (!silent) {
			this.containerElement?.focus();
		}
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
	private _onCheckboxToggle(node: LTreeNode<T>) {
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
		this._setFocusedNode(node);

		// Update visual states for toggled nodes and their ancestors
		// Collect unique root paths to update (the top-level nodes that were directly toggled)
		const rootPaths = isMultiHighlighted ? [...this.highlightedPaths] : [node.path];
		for (const rp of rootPaths) {
			const rn = this.tree.getNodeByPath(rp);
			if (!rn) continue;
			if (this.checkboxMode === 'cascade') {
				const vs = this._computeVisualState(rn);
				if (rn.visualState !== vs) {
					rn.visualState = vs;
					rn._rev = (rn._rev || 0) + 1;
				}
			}
			this._updateAncestorVisualStates(rp);
		}

		this.onNodeClickHandler?.(node);
		this._notifySelectionChanged();
		this.tree.refresh();
		this.containerElement?.focus();
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
		if (this.focusedNode && this.focusedNode.path !== node?.path) {
			this.focusedNode.isFocused = false;
			this.focusedNode._rev = (this.focusedNode._rev || 0) + 1;
		}
		if (node) {
			node.isFocused = true;
			node._rev = (node._rev || 0) + 1;
		}
		this.focusedNode = node;
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
			this.onHighlightChangeHandler(this.highlightedPaths, nodes);
		}
	}

	/** Notify listeners about checkbox selection change */
	private _notifySelectionChanged() {
		if (this.onSelectionChangeHandler) {
			const nodes = this.getSelectedNodes();
			this.onSelectionChangeHandler(this.selectedPaths, nodes);
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

	/** Highlight a node with the given mode.
	 *  Pass `{ silent: true }` to update state without firing `onNodeClick` / `onHighlightChange`
	 *  (useful when restoring state from URL params or other external sources). */
	highlightNode(path: string, mode: 'replace' | 'toggle' | 'range' = 'replace', options?: { silent?: boolean }) {
		const node = this.tree.getNodeByPath(path);
		if (!node) return;

		if (mode === 'toggle') {
			this._onNodeClicked(node, { ctrl: true, shift: false }, options);
		} else if (mode === 'range') {
			this._onNodeClicked(node, { ctrl: false, shift: true }, options);
		} else {
			this._onNodeClicked(node, undefined, options);
		}
	}

	/** Highlight multiple nodes by paths (replaces current highlights).
	 *  Pass `{ silent: true }` to skip `onHighlightChange`. */
	highlightNodes(paths: string[], options?: { silent?: boolean }) {
		this._clearAllHighlightFlags();
		const newPaths = new Set<string>();
		let lastNode: LTreeNode<T> | null = null;
		for (const path of paths) {
			const node = this.tree.getNodeByPath(path);
			if (node) {
				node.isHighlighted = true;
				node._rev = (node._rev || 0) + 1;
				newPaths.add(path);
				lastNode = node;
			}
		}
		this.highlightedPaths = newPaths;
		if (lastNode) {
			this._setFocusedNode(lastNode);
			this.lastHighlightedPath = lastNode.path;
		}
		if (!options?.silent) this._notifyHighlightChanged();
		this.tree.refresh();
	}

	/** Clear all highlights. Pass `{ silent: true }` to skip `onHighlightChange`. */
	clearHighlight(options?: { silent?: boolean }) {
		this._clearAllHighlightFlags();
		this.highlightedPaths = new Set();
		this.lastHighlightedPath = null;
		if (!options?.silent) this._notifyHighlightChanged();
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

	/** Clear all checkbox selections. Pass `{ silent: true }` to skip `onSelectionChange`. */
	deselectAll(options?: { silent?: boolean }) {
		this._clearAllSelectionFlags();
		this.selectedPaths = new Set();
		if (!options?.silent) this._notifySelectionChanged();
		this.tree.refresh();
	}

	/** @deprecated Use highlightNode() instead */
	selectNode(path: string, mode: 'replace' | 'toggle' | 'range' = 'replace', options?: { silent?: boolean }) {
		this.highlightNode(path, mode, options);
	}

	/** @deprecated Use highlightNodes() instead */
	selectNodes(paths: string[], options?: { silent?: boolean }) {
		this.highlightNodes(paths, options);
	}

	private _onNodeRightClicked(node: LTreeNode<T>, event: MouseEvent) {
		if (!this.hasContextMenuSnippet && !this.getContextMenuItemsHandler) {
			return;
		}

		// If right-clicking on an unhighlighted node, clear highlights and highlight only this node
		if (!this.highlightedPaths.has(node.path)) {
			this._clearAllHighlightFlags();
			node.isHighlighted = true;
			node._rev = (node._rev || 0) + 1;
			this.highlightedPaths = new Set([node.path]);
			this._setFocusedNode(node);
			this.lastHighlightedPath = node.path;
			this._notifyHighlightChanged();
			this.tree.refresh();
		}

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
			allowCopy: this.allowCopy,
			treeId: this.treeId
		});
		this.draggedNode = node;
		this.isDragInProgress = true;
		this.onNodeDragStartHandler?.(node, event);
	}

	_onNodeDragEnd = (event: DragEvent) => {
		dragLogger.debug('Drag ended', {
			dropEffect: event.dataTransfer?.dropEffect,
			operation: this.currentDropOperation
		});
		this._resetDragState();
	};

	private _resetDragState(): void {
		dragLogger.debug('_resetDragState');
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

		if (this.allowCopy && isDragEvent && ctrlKey) {
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
		if (isSameTreeDrag && operation === 'move' && dropNode) {
			if (this.autoHandleMove) {
				const result = this.moveNode(draggedNodeRef.path, dropNode.path, position);
				this.onNodeDropHandler?.(dropNode, draggedNodeRef, position, event, operation);
				return result.success;
			}
			// autoHandleMove=false: don't modify tree, just notify consumer
			this.onNodeDropHandler?.(dropNode, draggedNodeRef, position, event, operation);
			return true;
		}

		if (isSameTreeDrag && operation === 'copy' && dropNode && this.autoHandleCopy) {
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
			this.onNodeDropHandler?.(dropNode, draggedNodeRef, position, event, operation);
			return result.success;
		}

		this.onNodeDropHandler?.(dropNode, draggedNodeRef, position, event, operation);
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

		const isValidDrop = effectiveDraggedNode
			? isCrossTreeDrag || effectiveDraggedNode.path !== node.path
			: this.isDragInProgress;

		if (isValidDrop) {
			event.preventDefault();
			this.hoveredNodeForDrop = node;
			const nodeElement = (event.target as Element).closest('.ltree-node-content');
			if (nodeElement) {
				this.activeDropPosition = this.calculateDropPosition(event, nodeElement);
			}
			this.currentDropOperation = this.allowCopy && event.ctrlKey ? 'copy' : 'move';
			this.onNodeDragOverHandler?.(node, event);

			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = this.currentDropOperation;
			}

			// Capture node rect for floating drop zones (rendered at Tree level with position:fixed)
			if (this.dropZoneMode === 'floating') {
				const nodeRow = (event.target as Element).closest('.ltree-node-row');
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
			event.dataTransfer.dropEffect = (this.allowCopy && event.ctrlKey) ? 'copy' : 'move';
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

			const placeholder = dropElement?.closest('.ltree-empty-state');
			const rootDropZone = dropElement?.closest('.ltree-root-drop-zone');
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
	}

	private createGhostElement(node: LTreeNode<any>, x: number, y: number) {
		// Remove any stale ghost elements (e.g. from interrupted drags)
		this.removeGhostElement();
		document.querySelectorAll('.ltree-touch-ghost').forEach(el => el.remove());

		const ghost = document.createElement('div');
		ghost.className = 'ltree-touch-ghost';
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
		if (typeof document === 'undefined') return;
		this._removeDocumentTouchListeners();
		this.removeGhostElement();
		// Remove any orphaned ghosts from document body
		document.querySelectorAll('.ltree-touch-ghost').forEach(el => el.remove());
	}

	private findNodeFromElement(element: Element | null): LTreeNode<any> | null {
		if (!element) return null;
		const nodeElement = element.closest('.ltree-node');
		if (!nodeElement) return null;
		const path = nodeElement.getAttribute('data-tree-path');
		if (!path) return null;
		return this.tree.getNodeByPath(path);
	}

	private updateDropTarget(element: Element | null) {
		const newTarget = this.findNodeFromElement(element);

		if (this.touchDragState.currentDropTarget && this.touchDragState.currentDropTarget !== newTarget) {
			const prevElement = document.querySelector(
				`[data-tree-path="${this.touchDragState.currentDropTarget.path}"] .ltree-node-content`
			);
			prevElement?.classList.remove(this.dragOverNodeClass || 'ltree-dragover-highlight');
		}

		const placeholder = element?.closest('.ltree-empty-state');
		if (placeholder && !newTarget) {
			this.isDropPlaceholderActive = true;
			this.touchDragState.currentDropTarget = null;
			return;
		} else {
			this.isDropPlaceholderActive = false;
		}

		if (newTarget && newTarget !== this.draggedNode && newTarget.isDropAllowed) {
			const targetElement = document.querySelector(
				`[data-tree-path="${newTarget.path}"] .ltree-node-content`
			);
			targetElement?.classList.add(this.dragOverNodeClass || 'ltree-dragover-highlight');
			this.touchDragState.currentDropTarget = newTarget;
		} else {
			this.touchDragState.currentDropTarget = null;
		}
	}

	private clearDropTargetHighlight() {
		if (this.touchDragState.currentDropTarget) {
			const element = document.querySelector(
				`[data-tree-path="${this.touchDragState.currentDropTarget.path}"] .ltree-node-content`
			);
			element?.classList.remove(this.dragOverNodeClass || 'ltree-dragover-highlight');
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
				this.selectNode(path, 'replace');
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

	/** Extend highlight to target path (Shift+nav) — uses range from anchor, moves focus */
	private _navHighlightTo(path: string) {
		// Set anchor if not set
		if (!this.lastHighlightedPath && this.focusedNode) {
			this.lastHighlightedPath = this.focusedNode.path;
			// Ensure anchor is highlighted
			const anchorNode = this.focusedNode;
			if (!anchorNode.isHighlighted) {
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
