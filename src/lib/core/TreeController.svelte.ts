import type { Index, SearchOptions } from 'flexsearch';
import { type LTreeNode } from '../ltree/ltree-node.svelte.js';
import { createLTree } from '../ltree/ltree.svelte.js';
import {
	type Ltree,
	type InsertArrayResult,
	type ContextMenuEntry,
	type DropPosition,
	type DragDropMode,
	type DropOperation,
	type TreeChange,
	type ApplyChangesResult,
	type ToggleIconMode
} from '../ltree/types.js';
import { tick } from 'svelte';
import {
	createRenderCoordinator,
	type RenderCoordinator,
	type RenderStats
} from '../components/RenderCoordinator.svelte.js';
import { uiLogger, dragLogger } from '../logger.js';
import { perfStart, perfEnd } from '../perf-logger.js';

// Re-register global API (safe to import multiple times)
import '../global-api.js';

// ─── Shared interfaces (also used by Node.svelte) ────────────────────────

export interface SelectionModifiers {
	ctrl: boolean;
	shift: boolean;
}

export interface NodeCallbacks<T> {
	onNodeClicked: (node: LTreeNode<T>, modifiers?: SelectionModifiers) => void;
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
	shouldToggleOnNodeClick: boolean;
	expandIconClass: string;
	collapseIconClass: string;
	leafIconClass: string;
	toggleIconMode: ToggleIconMode;
	selectedNodeClass: string | null | undefined;
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
	selectedNode?: LTreeNode<T> | null | undefined;

	// BEHAVIOUR
	expandLevel?: number | null | undefined;
	shouldToggleOnNodeClick?: boolean | null | undefined;
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
	accordionExpand?: boolean;

	// EVENTS
	onNodeClicked?: (node: LTreeNode<T>) => void;
	onNodeDragStart?: (node: LTreeNode<T>, event: DragEvent) => void;
	onNodeDragOver?: (node: LTreeNode<T>, event: DragEvent) => void;
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
	onNodeDrop?: (
		dropNode: LTreeNode<T> | null,
		draggedNode: LTreeNode<T>,
		position: DropPosition,
		event: DragEvent | TouchEvent,
		operation: DropOperation
	) => void;
	contextMenuCallback?: (
		node: LTreeNode<T>,
		closeMenuCallback: () => void,
		selectedNodes?: LTreeNode<T>[]
	) => ContextMenuEntry[];
	onSelectionChanged?: (paths: Set<string>, nodes: LTreeNode<T>[]) => void;

	// Tells the controller whether a context menu snippet exists (set by Tree.svelte)
	hasContextMenuSnippet?: boolean;

	// VISUALS
	bodyClass?: string | null | undefined;
	selectedNodeClass?: string | null | undefined;
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
		shouldToggleOnNodeClick: true,
		expandIconClass: 'ltree-icon-expand',
		collapseIconClass: 'ltree-icon-collapse',
		leafIconClass: 'ltree-icon-leaf',
		selectedNodeClass: undefined,
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
	selectedNode = $state.raw<LTreeNode<T> | null | undefined>(null);
	selectedPaths = $state.raw<Set<string>>(new Set());
	lastSelectedPath: string | null = null;
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

	// EVENTS (stored for calling — plain assignments, not deeply proxied)
	onNodeClickedCb: ((node: LTreeNode<T>) => void) | undefined;
	onSelectionChangedCb: ((paths: Set<string>, nodes: LTreeNode<T>[]) => void) | undefined;
	onNodeDragStartCb: ((node: LTreeNode<T>, event: DragEvent) => void) | undefined;
	onNodeDragOverCb: ((node: LTreeNode<T>, event: DragEvent) => void) | undefined;
	beforeDropCallbackCb: TreeControllerProps<T>['beforeDropCallback'];
	onNodeDropCb: TreeControllerProps<T>['onNodeDrop'];
	contextMenuCallbackCb: TreeControllerProps<T>['contextMenuCallback'];
	onRenderStartCb: (() => void) | undefined;
	onRenderProgressCb: ((stats: RenderStats) => void) | undefined;
	onRenderCompleteCb: ((stats: RenderStats) => void) | undefined;

	// Visual config (for nodeConfig updates)
	shouldToggleOnNodeClick = $state(true);
	expandIconClass = $state('ltree-icon-expand');
	collapseIconClass = $state('ltree-icon-collapse');
	leafIconClass = $state('ltree-icon-leaf');
	toggleIconMode = $state<ToggleIconMode>('rotate');
	selectedNodeClass = $state<string | null | undefined>(undefined);
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
		this.selectedNode = props.selectedNode ?? null;
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
		this.accordionExpand = props.accordionExpand ?? false;

		this.shouldToggleOnNodeClick = props.shouldToggleOnNodeClick ?? true;
		this.expandIconClass = props.expandIconClass ?? 'ltree-icon-expand';
		this.collapseIconClass = props.collapseIconClass ?? 'ltree-icon-collapse';
		this.leafIconClass = props.leafIconClass ?? 'ltree-icon-leaf';
		this.toggleIconMode = props.toggleIconMode ?? 'rotate';
		this.selectedNodeClass = props.selectedNodeClass;
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
		this.onNodeClickedCb = props.onNodeClicked;
		this.onSelectionChangedCb = props.onSelectionChanged;
		this.onNodeDragStartCb = props.onNodeDragStart;
		this.onNodeDragOverCb = props.onNodeDragOver;
		this.beforeDropCallbackCb = props.beforeDropCallback;
		this.onNodeDropCb = props.onNodeDrop;
		this.contextMenuCallbackCb = props.contextMenuCallback;
		this.onRenderStartCb = props.onRenderStart;
		this.onRenderProgressCb = props.onRenderProgress;
		this.onRenderCompleteCb = props.onRenderComplete;

		// ── Create LTree ────────────────────────────────────────────────
		// svelte-ignore non_reactive_update
		this.tree = createLTree<T>(
			props.idMember,
			props.pathMember,
			props.parentPathMember,
			props.levelMember,
			props.hasChildrenMember,
			props.isExpandedMember,
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
						this.onRenderStartCb?.();
					},
					onProgress: (stats) => {
						this.onRenderProgressCb?.(stats);
					},
					onComplete: (stats) => {
						this.isRendering = false;
						this.onRenderCompleteCb?.(stats);
					}
				})
			: null;

		// ── Create stable nodeCallbacks ─────────────────────────────────
		this.nodeCallbacks = {
			onNodeClicked: (node: LTreeNode<T>, modifiers?: SelectionModifiers) => this._onNodeClicked(node, modifiers),
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
			shouldToggleOnNodeClick: this.shouldToggleOnNodeClick,
			expandIconClass: this.expandIconClass,
			collapseIconClass: this.collapseIconClass,
			leafIconClass: this.leafIconClass,
			toggleIconMode: this.toggleIconMode,
			selectedNodeClass: this.selectedNodeClass,
			dragOverNodeClass: this.dragOverNodeClass,
			dropZoneMode: this.dropZoneMode,
			dropZoneLayout: this.dropZoneLayout,
			dropZoneStart: this.dropZoneStart,
			dropZoneMaxWidth: this.dropZoneMaxWidth,
			allowCopy: this.allowCopy,
			accordionExpand: this.accordionExpand
		};

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
				shouldToggleOnNodeClick: this.shouldToggleOnNodeClick,
				expandIconClass: this.expandIconClass,
				collapseIconClass: this.collapseIconClass,
				leafIconClass: this.leafIconClass,
				toggleIconMode: this.toggleIconMode,
				selectedNodeClass: this.selectedNodeClass,
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
				(this.hasContextMenuSnippet || this.contextMenuCallbackCb) &&
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
		this.onNodeDragOverCb?.(node, event);
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
		if (updates.selectedNode !== undefined) this.selectedNode = updates.selectedNode;
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

		if (updates.shouldToggleOnNodeClick !== undefined)
			this.shouldToggleOnNodeClick = updates.shouldToggleOnNodeClick ?? true;
		if (updates.expandIconClass !== undefined)
			this.expandIconClass = updates.expandIconClass ?? 'ltree-icon-expand';
		if (updates.collapseIconClass !== undefined)
			this.collapseIconClass = updates.collapseIconClass ?? 'ltree-icon-collapse';
		if (updates.leafIconClass !== undefined)
			this.leafIconClass = updates.leafIconClass ?? 'ltree-icon-leaf';
		if (updates.selectedNodeClass !== undefined)
			this.selectedNodeClass = updates.selectedNodeClass;
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
		if (updates.onNodeClicked !== undefined) this.onNodeClickedCb = updates.onNodeClicked;
		if (updates.onNodeDragStart !== undefined) this.onNodeDragStartCb = updates.onNodeDragStart;
		if (updates.onNodeDragOver !== undefined) this.onNodeDragOverCb = updates.onNodeDragOver;
		if (updates.beforeDropCallback !== undefined)
			this.beforeDropCallbackCb = updates.beforeDropCallback;
		if (updates.onNodeDrop !== undefined) this.onNodeDropCb = updates.onNodeDrop;
		if (updates.contextMenuCallback !== undefined)
			this.contextMenuCallbackCb = updates.contextMenuCallback;
		if (updates.onSelectionChanged !== undefined)
			this.onSelectionChangedCb = updates.onSelectionChanged;
	}

	// ── Internal event handlers ─────────────────────────────────────────

	private async _onNodeClicked(node: LTreeNode<T>, modifiers?: SelectionModifiers) {
		if (this.contextMenuVisible) {
			this.closeContextMenu();
		}

		const ctrl = modifiers?.ctrl ?? false;
		const shift = modifiers?.shift ?? false;

		uiLogger.debug(`[multi-select] Click on ${node.path}`, { ctrl, shift, lastAnchor: this.lastSelectedPath, prevCount: this.selectedPaths.size });

		if (ctrl) {
			// Toggle this node in/out of selection
			const newPaths = new Set(this.selectedPaths);
			if (newPaths.has(node.path)) {
				newPaths.delete(node.path);
				node.isSelected = false;
				uiLogger.debug(`[multi-select] Ctrl+click: deselected ${node.path}`, { selectedCount: newPaths.size });
			} else {
				newPaths.add(node.path);
				node.isSelected = true;
				uiLogger.debug(`[multi-select] Ctrl+click: added ${node.path}`, { selectedCount: newPaths.size });
			}
			this.selectedPaths = newPaths;
			this.lastSelectedPath = node.path;
		} else if (shift && this.lastSelectedPath) {
			// Range select from lastSelectedPath to this node
			uiLogger.debug(`[multi-select] Shift+click: range ${this.lastSelectedPath} → ${node.path} (mode: ${this.rangeSelectionMode})`);
			const rangePaths = this._getNodesBetween(this.lastSelectedPath, node.path);
			uiLogger.debug(`[multi-select] Range result: ${rangePaths.length} nodes`, { paths: rangePaths });
			// Clear previous selection
			this._clearAllSelectionFlags();
			const newPaths = new Set<string>();
			for (const path of rangePaths) {
				newPaths.add(path);
				const n = this.tree.getNodeByPath(path);
				if (n) n.isSelected = true;
			}
			this.selectedPaths = newPaths;
			// Don't update lastSelectedPath on shift+click (anchor stays)
		} else {
			// Normal click: clear all, select only this node
			if (this.selectedPaths.size > 1) {
				uiLogger.debug(`[multi-select] Plain click: clearing ${this.selectedPaths.size} nodes, selecting ${node.path}`);
			}
			this._clearAllSelectionFlags();
			node.isSelected = true;
			const newPaths = new Set<string>();
			newPaths.add(node.path);
			this.selectedPaths = newPaths;
			this.lastSelectedPath = node.path;
		}

		// Always update selectedNode to the clicked node (backward compat)
		this.selectedNode = node;

		uiLogger.debug(`[multi-select] Selection updated: ${this.selectedPaths.size} nodes selected`, {
			paths: [...this.selectedPaths]
		});

		this.onNodeClickedCb?.(node);
		this._notifySelectionChanged();
		this.tree.refresh();
	}

	/** Clear isSelected flag on all currently selected nodes */
	private _clearAllSelectionFlags() {
		for (const path of this.selectedPaths) {
			const n = this.tree.getNodeByPath(path);
			if (n) n.isSelected = false;
		}
	}

	/** Notify listeners about selection change */
	private _notifySelectionChanged() {
		if (this.onSelectionChangedCb) {
			const nodes = this.getSelectedNodes();
			this.onSelectionChangedCb(this.selectedPaths, nodes);
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

	// ── Public multi-select methods ─────────────────────────────────────

	/** Select a node with the given mode */
	selectNode(path: string, mode: 'replace' | 'toggle' | 'range' = 'replace') {
		uiLogger.debug(`[multi-select] selectNode("${path}", "${mode}")`);
		const node = this.tree.getNodeByPath(path);
		if (!node) {
			uiLogger.debug(`[multi-select] selectNode: node not found at path "${path}"`);
			return;
		}

		if (mode === 'toggle') {
			this._onNodeClicked(node, { ctrl: true, shift: false });
		} else if (mode === 'range') {
			this._onNodeClicked(node, { ctrl: false, shift: true });
		} else {
			this._onNodeClicked(node);
		}
	}

	/** Select multiple nodes by paths (replaces current selection) */
	selectNodes(paths: string[]) {
		uiLogger.debug(`[multi-select] selectNodes: ${paths.length} paths`, { paths });
		this._clearAllSelectionFlags();
		const newPaths = new Set<string>();
		let lastNode: LTreeNode<T> | null = null;
		let notFound = 0;
		for (const path of paths) {
			const node = this.tree.getNodeByPath(path);
			if (node) {
				node.isSelected = true;
				newPaths.add(path);
				lastNode = node;
			} else {
				notFound++;
			}
		}
		this.selectedPaths = newPaths;
		if (lastNode) {
			this.selectedNode = lastNode;
			this.lastSelectedPath = lastNode.path;
		}
		uiLogger.debug(`[multi-select] selectNodes: ${newPaths.size} selected, ${notFound} not found`);
		this._notifySelectionChanged();
		this.tree.refresh();
	}

	/** Clear all selection */
	deselectAll() {
		uiLogger.debug(`[multi-select] deselectAll: clearing ${this.selectedPaths.size} nodes`);
		this._clearAllSelectionFlags();
		this.selectedPaths = new Set();
		this.selectedNode = null;
		this.lastSelectedPath = null;
		this._notifySelectionChanged();
		this.tree.refresh();
	}

	/** Get all selected nodes */
	getSelectedNodes(): LTreeNode<T>[] {
		const nodes: LTreeNode<T>[] = [];
		for (const path of this.selectedPaths) {
			const node = this.tree.getNodeByPath(path);
			if (node) nodes.push(node);
		}
		return nodes;
	}

	/** Check if a specific node path is selected */
	isNodeSelected(path: string): boolean {
		return this.selectedPaths.has(path);
	}

	private _onNodeRightClicked(node: LTreeNode<T>, event: MouseEvent) {
		if (!this.hasContextMenuSnippet && !this.contextMenuCallbackCb) {
			return;
		}

		// If right-clicking on an unselected node, clear multi-selection and select only this node
		if (!this.selectedPaths.has(node.path)) {
			uiLogger.debug(`[multi-select] Right-click on unselected node ${node.path}, clearing ${this.selectedPaths.size} selected nodes`);
			this._clearAllSelectionFlags();
			node.isSelected = true;
			this.selectedPaths = new Set([node.path]);
			this.selectedNode = node;
			this.lastSelectedPath = node.path;
			this._notifySelectionChanged();
			this.tree.refresh();
		} else {
			uiLogger.debug(`[multi-select] Right-click on selected node ${node.path}, keeping ${this.selectedPaths.size} selected nodes`);
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
		this.onNodeDragStartCb?.(node, event);
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

		if (this.beforeDropCallbackCb) {
			const result = await this.beforeDropCallbackCb(
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
			const result = this.moveNode(draggedNodeRef.path, dropNode.path, position);
			this.onNodeDropCb?.(dropNode, draggedNodeRef, position, event, operation);
			return result.success;
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
			this.onNodeDropCb?.(dropNode, draggedNodeRef, position, event, operation);
			return result.success;
		}

		this.onNodeDropCb?.(dropNode, draggedNodeRef, position, event, operation);
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
			this.onNodeDragOverCb?.(node, event);

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
