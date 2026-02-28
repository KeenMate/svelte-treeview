<script lang="ts" generics="T">
	import type { Index, SearchOptions } from 'flexsearch';
	import Node from './Node.svelte';
	import { type LTreeNode } from '../ltree/ltree-node.svelte.js';
	import { createLTree } from '../ltree/ltree.svelte.js';
	import { type Ltree, type InsertArrayResult, type ContextMenuItem, type DropPosition, type DragDropMode, type DropOperation } from '../ltree/types.js';
	import { setContext, tick, untrack } from 'svelte';
	import { createRenderCoordinator, type RenderCoordinator, type RenderStats } from './RenderCoordinator.svelte.js';
	import { uiLogger, dragLogger } from '../logger.js';
	import { perfStart, perfEnd } from '../perf-logger.js';

	// Context types for stable function references (prevents re-renders from inline arrow functions)
	export interface NodeCallbacks<T> {
		onNodeClicked: (node: LTreeNode<T>) => void;
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
		selectedNodeClass: string | null | undefined;
		dragOverNodeClass: string | null | undefined;
		dropZoneMode: 'floating' | 'glow';
		dropZoneLayout: 'around' | 'above' | 'below' | 'wave' | 'wave2';
		dropZoneStart: number | string;
		dropZoneMaxWidth: number;
		allowCopy: boolean;
	}


	// Register global API for runtime logging control
	import '../global-api.js';

	// Context menu state
	let contextMenuVisible = $state(false);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);
	let contextMenuNode: LTreeNode<T> | null = $state(null);

	// Scroll highlight state - track current highlight to clear on next scroll
	let currentHighlight: { element: HTMLElement; timeoutId: ReturnType<typeof setTimeout> } | null = null;

	// Drag and drop state
	let draggedNode: LTreeNode<any> | null = $state.raw(null);

	// Touch drag state for mobile support
	let touchDragState = $state<{
		node: LTreeNode<any> | null;
		startX: number;
		startY: number;
		isDragging: boolean;
		ghostElement: HTMLElement | null;
		currentDropTarget: LTreeNode<any> | null;
	}>({ node: null, startX: 0, startY: 0, isDragging: false, ghostElement: null, currentDropTarget: null });

	let touchTimer: ReturnType<typeof setTimeout> | null = null;

	// Progressive rendering for flat mode
	// Track which node IDs we've rendered and progressively add new ones
	let flatRenderedIds = $state.raw<Set<string>>(new Set());
	let flatRenderQueue = $state.raw<string[]>([]);
	let flatRenderAnimationFrame: number | null = null;
	let currentBatchSize: number = 0; // Exponential: doubles each batch up to maxBatchSize

	// Virtual scrolling state
	let vsScrollTop = $state(0);
	let vsMeasuredRowHeight = $state<number | null>(null);
	let vsContainerRef = $state<HTMLDivElement | undefined>();
	let vsDetectedHeight = $state<string | null>(null);

	// Drop placeholder state for empty trees
	let isDropPlaceholderActive = $state(false);

	// Advanced drag state for position indicators
	let isDragInProgress = $state(false);
	let hoveredNodeForDrop = $state<LTreeNode<any> | null>(null);
	let activeDropPosition = $state<DropPosition | null>(null);
	let currentDropOperation = $state<DropOperation>('move');

	// Flag to skip insertArray during internal mutations (addNode, moveNode, removeNode)
	let _skipInsertArray = false;

	interface Props {
		// MAPPINGS
		idMember: string;
		pathMember: string;
		parentPathMember?: string | null | undefined;
		levelMember?: string | null | undefined;
		isExpandedMember?: string | null | undefined;
		isSelectedMember?: string | null | undefined;
		isDraggableMember?: string | null | undefined;
		isDropAllowedMember?: string | null | undefined;
		allowedDropPositionsMember?: string | null | undefined;
		getAllowedDropPositionsCallback?: (node: LTreeNode<T>) => DropPosition[] | null | undefined;
		hasChildrenMember?: string | null | undefined;
		isSorted?: boolean | null | undefined;

		displayValueMember?: string | null | undefined;
		getDisplayValueCallback?: (node: LTreeNode<T>) => string;

		searchValueMember?: string | null | undefined;
		getSearchValueCallback?: (node: LTreeNode<T>) => string;

		// For sibling ordering in drag-drop (above/below positioning)
		orderMember?: string | null | undefined;

		treeId?: string | null | undefined;
		treePathSeparator?: string | null | undefined;
		sortCallback?: (items: LTreeNode<T>[]) => LTreeNode<T>[];

		// DATA
		data: T[];
		selectedNode?: LTreeNode<T> | null | undefined;
		insertResult?: InsertArrayResult<T> | null | undefined;

		// SLOTS
		nodeTemplate?: any;
		treeHeader?: any;
		treeBody?: any;
		treeFooter?: any;
		noDataFound?: any;
		contextMenu?: any;
		dropPlaceholder?: any;
		loadingPlaceholder?: any;

		// BEHAVIOUR
		expandLevel?: number | null | undefined;
		shouldToggleOnNodeClick?: boolean | null | undefined;
		initializeIndexCallback?: () => Index;
		searchText?: string | null | undefined;
		shouldUseInternalSearchIndex?: boolean | null | undefined;
		indexerBatchSize?: number | null | undefined;
		indexerTimeout?: number | null | undefined;
		shouldDisplayDebugInformation?: boolean;
		shouldDisplayContextMenuInDebugMode?: boolean;
		isLoading?: boolean;

		// Progressive rendering - render children in batches to avoid UI freeze
		progressiveRender?: boolean;
		initialBatchSize?: number;
		maxBatchSize?: number;
		isRendering?: boolean; // Bindable: true while progressive rendering is active
		onRenderStart?: () => void;
		onRenderProgress?: (stats: RenderStats) => void;
		onRenderComplete?: (stats: RenderStats) => void;

		/**
		 * Use flat/centralized rendering instead of recursive node rendering.
		 * This significantly improves performance for large trees by:
		 * - Using a single flat loop instead of recursive component instantiation
		 * - Allowing Svelte's keyed {#each} to efficiently diff only changed nodes
		 * - Per-node reactive signals for O(1) data-only updates (updateNode, selection)
		 */
		useFlatRendering?: boolean;
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
		dropZoneMode?: 'floating' | 'glow'; // 'floating' = original floating zones, 'glow' = border glow indicators
		dropZoneLayout?: 'around' | 'above' | 'below' | 'wave' | 'wave2';
		dropZoneStart?: number | string; // number = percentage (0-100), string = any CSS value ("33%", "50px", "3rem")
		dropZoneMaxWidth?: number; // max width in pixels for wave layouts
		allowCopy?: boolean; // Enable Ctrl+drag to copy instead of move (default: false)
		autoHandleCopy?: boolean; // Auto-handle same-tree copy operations (default: true). Set to false for external DB/API handling.

		// EVENTS
		onNodeClicked?: (node: LTreeNode<T>) => void;
		onNodeDragStart?: (node: LTreeNode<T>, event: DragEvent) => void;
		onNodeDragOver?: (node: LTreeNode<T>, event: DragEvent) => void;
		/**
		 * Called before a drop is processed. Return false to cancel the drop.
		 * Return { position, operation } to override the drop position or operation.
		 * Return true or undefined to proceed normally.
		 * Can be async - return a Promise to show dialogs or perform async validation.
		 */
		beforeDropCallback?: (dropNode: LTreeNode<T> | null, draggedNode: LTreeNode<T>, position: DropPosition, event: DragEvent | TouchEvent, operation: DropOperation) => boolean | { position?: DropPosition; operation?: DropOperation } | void | Promise<boolean | { position?: DropPosition; operation?: DropOperation } | void>;
		onNodeDrop?: (dropNode: LTreeNode<T> | null, draggedNode: LTreeNode<T>, position: DropPosition, event: DragEvent | TouchEvent, operation: DropOperation) => void;
		contextMenuCallback?: (node: LTreeNode<T>, closeMenuCallback: () => void) => ContextMenuItem[];

		// VISUALS
		bodyClass?: string | null | undefined;
		selectedNodeClass?: string | null | undefined;
		dragOverNodeClass?: string | null | undefined;
		expandIconClass?: string | null | undefined;
		collapseIconClass?: string | null | undefined;
		leafIconClass?: string | null | undefined;
		scrollHighlightTimeout?: number | null | undefined;
		scrollHighlightClass?: string | null | undefined;
		contextMenuXOffset?: number | null | undefined;
		contextMenuYOffset?: number | null | undefined;
	}

	let {
		treeId,
		treePathSeparator = '.',

		// MAPPINGS
		idMember,
		pathMember,
		parentPathMember,
		levelMember,
		hasChildrenMember,

		isExpandedMember,
		isSelectedMember,
		isDraggableMember,
		isDropAllowedMember,
		allowedDropPositionsMember,
		getAllowedDropPositionsCallback,

		displayValueMember,
		getDisplayValueCallback,
		searchValueMember,
		getSearchValueCallback,
		orderMember,
		isSorted,
		sortCallback,

		// DATA
		data = $bindable(),
		selectedNode = $bindable(),
		insertResult = $bindable(),

		// SLOTS
		nodeTemplate = undefined,
		treeHeader = undefined,
		treeFooter = undefined,
		noDataFound = undefined,
		contextMenu = undefined,
		dropPlaceholder = undefined,
		loadingPlaceholder = undefined,

		// BEHAVIOUR
		expandLevel = 2,

		shouldToggleOnNodeClick = true,
		shouldUseInternalSearchIndex = true,
		initializeIndexCallback,
		searchText = $bindable(),
		indexerBatchSize = 25,
		indexerTimeout = 50,
		shouldDisplayDebugInformation = false,
		shouldDisplayContextMenuInDebugMode = false,
		isLoading = false,

		// Progressive rendering (exponential batching: 20 → 40 → 80 → 160...)
		progressiveRender = true,
		initialBatchSize = 20,
		maxBatchSize = 500,
		isRendering = $bindable(false),
		onRenderStart,
		onRenderProgress,
		onRenderComplete,

		// Flat rendering mode
		useFlatRendering = true,

		// Virtual scrolling (flat mode only)
		virtualScroll = false,
		virtualRowHeight = undefined,
		virtualOverscan = 5,
		virtualContainerHeight = undefined,

		// DRAG AND DROP
		dragDropMode = 'none',
		dropZoneMode = 'glow',
		dropZoneLayout = 'around',
		dropZoneStart = 33,
		dropZoneMaxWidth = 120,
		allowCopy = false,
		autoHandleCopy = true,

		// EVENTS
		onNodeClicked,
		onNodeDragStart,
		onNodeDragOver,
		beforeDropCallback,
		onNodeDrop,
		contextMenuCallback,

		// VISUALS
		bodyClass,
		expandIconClass = 'ltree-icon-expand',
		collapseIconClass = 'ltree-icon-collapse',
		leafIconClass = 'ltree-icon-leaf',
		selectedNodeClass,
		dragOverNodeClass,
		scrollHighlightTimeout = 4000,
		scrollHighlightClass = 'ltree-scroll-highlight',
		contextMenuXOffset = 8,
		contextMenuYOffset = 0
	}: Props = $props();

	export async function expandNodes(nodePath: string) {
		tree.expandNodes(nodePath);
	}

	export async function collapseNodes(nodePath: string) {
		tree.collapseNodes(nodePath);
	}

	export function expandAll(nodePath?: string | null | undefined) {
		tree?.expandAll(nodePath);
	}

	export function collapseAll(nodePath?: string | null | undefined) {
		tree?.collapseAll(nodePath);
	}

	export function filterNodes(searchText: string, searchOptions?: SearchOptions): void {
		tree?.filterNodes(searchText, searchOptions);
	}

	export function searchNodes(
		searchText: string | null | undefined,
		searchOptions?: SearchOptions
	): LTreeNode<T>[] {
		return tree?.searchNodes(searchText, searchOptions) || [];
	}

	// Tree editor helper methods
	export function getChildren(parentPath: string): LTreeNode<T>[] {
		return tree?.getChildren(parentPath) || [];
	}

	export function getSiblings(path: string): LTreeNode<T>[] {
		return tree?.getSiblings(path) || [];
	}

	export function refreshSiblings(parentPath: string): void {
		tree?.refreshSiblings(parentPath);
	}

	export function refreshNode(path: string): void {
		tree?.refreshNode(path);
	}

	export function getNodeByPath(path: string): LTreeNode<T> | null {
		return tree?.getNodeByPath(path) || null;
	}

	// Tree editor mutation methods
	// These set _skipInsertArray to prevent the data effect from re-running insertArray
	// since these methods already update the tree structure directly.
	// We use tick() to reset the flag - if user updates data prop synchronously,
	// the effect runs before tick resolves and sees the flag. Otherwise tick resets it.
	export function moveNode(sourcePath: string, targetPath: string, position: 'above' | 'below' | 'child'): { success: boolean; error?: string } {
		_skipInsertArray = true;
		const result = tree?.moveNode(sourcePath, targetPath, position) || { success: false, error: 'Tree not initialized' };
		tick().then(() => { _skipInsertArray = false; });
		return result;
	}

	export function removeNode(path: string, includeDescendants: boolean = true): { success: boolean; node?: LTreeNode<T>; error?: string } {
		_skipInsertArray = true;
		const result = tree?.removeNode(path, includeDescendants) || { success: false, error: 'Tree not initialized' };
		tick().then(() => { _skipInsertArray = false; });
		return result;
	}

	export function addNode(parentPath: string, data: T, pathSegment?: string): { success: boolean; node?: LTreeNode<T>; error?: string } {
		_skipInsertArray = true;
		const result = tree?.addNode(parentPath, data, pathSegment) || { success: false, error: 'Tree not initialized' };
		tick().then(() => { _skipInsertArray = false; });
		return result;
	}

	export function updateNode(path: string, dataUpdates: Partial<T>): { success: boolean; node?: LTreeNode<T>; error?: string } {
		_skipInsertArray = true;
		const result = tree?.updateNode(path, dataUpdates) || { success: false, error: 'Tree not initialized' };
		tick().then(() => { _skipInsertArray = false; });
		return result;
	}

	export function applyChanges(changes: import('../ltree/types').TreeChange<T>[]): import('../ltree/types').ApplyChangesResult {
		_skipInsertArray = true;
		const result = tree?.applyChanges(changes) || { successful: 0, failed: [] };
		tick().then(() => { _skipInsertArray = false; });
		return result;
	}

	export function copyNodeWithDescendants(
		sourceNode: LTreeNode<T>,
		targetParentPath: string,
		transformData: (data: T) => T
	): { success: boolean; rootNode?: LTreeNode<T>; count: number; error?: string } {
		_skipInsertArray = true;
		const result = tree?.copyNodeWithDescendants(sourceNode, targetParentPath, transformData) || { success: false, count: 0, error: 'Tree not initialized' };
		tick().then(() => { _skipInsertArray = false; });
		return result;
	}

	// State persistence methods
	export function getExpandedPaths(): string[] {
		return tree?.getExpandedPaths() || [];
	}

	export function setExpandedPaths(paths: string[]): void {
		tree?.setExpandedPaths(paths);
	}

	export function getAllData(): T[] {
		return tree?.getAllData() || [];
	}

	// svelte-ignore non_reactive_update
	export function closeContextMenu() {
		contextMenuVisible = false;
		contextMenuNode = null;
		isDebugMenuActive = false;
	}

	export async function scrollToPath(
		path: string,
		options?: {
			/** Expand ancestors to make the node visible (default: true) */
			expand?: boolean;
			/** Also expand the target node itself to show its children (default: false for performance) */
			expandTarget?: boolean;
			highlight?: boolean;
			scrollOptions?: ScrollIntoViewOptions;
			/** Scroll only within the nearest scrollable container (prevents page scroll) */
			containerScroll?: boolean;
		}
	): Promise<boolean> {
		perfStart(`[${treeId}] scrollToPath`);
		const {
			expand = true,
			expandTarget = false,
			highlight = true,
			scrollOptions = { behavior: 'smooth', block: 'center' },
			containerScroll = false
		} = options || {};

		// First, find the node to get its ID
		const node = tree.getNodeByPath(path);
		if (!node || !node.id) {
			console.warn(`[Tree ${treeId}] Node not found for path: ${path}`);
			perfEnd(`[${treeId}] scrollToPath`);
			return false;
		}

		// Expand ancestors to make the node visible
		// The target node's visibility depends on its parent being expanded, not on its own isExpanded state
		if (expand && node.parentPath) {
			tree.expandNodes(node.parentPath);
		}

		// Optionally expand the target node itself (shows its children, but triggers re-render if not already expanded)
		if (expandTarget) {
			tree.expandNodes(path);
		}

		if (expand || expandTarget) {
			await tick();
		}

		// Helper: find DOM element and apply highlight
		const applyHighlight = (elementId: string): boolean => {
			const element = document.getElementById(elementId);
			const contentDiv = element?.querySelector('.ltree-node-content') as HTMLElement | null;
			if (!contentDiv) return false;

			if (currentHighlight) {
				currentHighlight.element.classList.remove(scrollHighlightClass!);
				clearTimeout(currentHighlight.timeoutId);
				currentHighlight = null;
			}
			contentDiv.classList.add(scrollHighlightClass!);
			const timeoutId = setTimeout(() => {
				contentDiv.classList.remove(scrollHighlightClass!);
				currentHighlight = null;
			}, scrollHighlightTimeout);
			currentHighlight = { element: contentDiv, timeoutId };
			return true;
		};

		// Virtual scroll: index-based scrolling instead of DOM query
		if (vsActive && vsContainerRef) {
			const nodeIndex = allFlatNodes.findIndex(n => n.path === path);
			if (nodeIndex === -1) {
				console.warn(`[Tree ${treeId}] Node not found in flat nodes for path: ${path}`);
				perfEnd(`[${treeId}] scrollToPath`);
				return false;
			}

			// Scroll virtual container to center the node
			const targetScroll = nodeIndex * vsRowHeight
				- (vsContainerRef.clientHeight / 2)
				+ vsRowHeight / 2;
			vsContainerRef.scrollTo({
				top: Math.max(0, targetScroll),
				behavior: scrollOptions?.behavior || 'smooth'
			});

			// Wait for scroll + re-render — need multiple frames for
			// rAF-throttled scroll handler → reactive update → DOM render
			await tick();
			await new Promise(r => requestAnimationFrame(r));
			await tick();
			await new Promise(r => requestAnimationFrame(r));

			if (highlight && scrollHighlightClass) {
				const elementId = `${treeId}-${node.id}`;
				if (!applyHighlight(elementId)) {
					// Element might not be rendered yet — retry after another frame
					await tick();
					await new Promise(r => requestAnimationFrame(r));
					applyHighlight(elementId);
				}
			}

			perfEnd(`[${treeId}] scrollToPath`);
			return true;
		}

		// Find the DOM element using the generated ID
		const elementId = `${treeId}-${node.id}`;
		const element = document.getElementById(elementId);
		const contentDiv = element?.querySelector('.ltree-node-content') as HTMLElement | null;

		if (!contentDiv) {
			console.warn(`[Tree ${treeId}] DOM element not found for node ID: ${elementId}`);
			perfEnd(`[${treeId}] scrollToPath`);
			return false;
		}

		// Scroll to the element
		if (containerScroll) {
			// Find nearest scrollable ancestor and scroll within it only
			const container = findScrollableAncestor(contentDiv);
			if (container) {
				const containerRect = container.getBoundingClientRect();
				const elementRect = contentDiv.getBoundingClientRect();
				const scrollTop = container.scrollTop + (elementRect.top - containerRect.top) - (containerRect.height / 2) + (elementRect.height / 2);
				container.scrollTo({
					top: scrollTop,
					behavior: scrollOptions?.behavior || 'smooth'
				});
			}
		} else {
			contentDiv.scrollIntoView(scrollOptions);
		}

		// Highlight the node temporarily if requested
		if (highlight && scrollHighlightClass) {
			applyHighlight(elementId);
		}

		perfEnd(`[${treeId}] scrollToPath`);
		return true;
	}

	/** Find the nearest scrollable ancestor element */
	function findScrollableAncestor(element: HTMLElement): HTMLElement | null {
		let parent = element.parentElement;
		while (parent) {
			const style = getComputedStyle(parent);
			const overflowY = style.overflowY;
			if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
				return parent;
			}
			parent = parent.parentElement;
		}
		return null;
	}

	// External update method for HTML/JavaScript usage
	export function update(
		updates: Partial<
			Pick<
				Props,
				| "treeId"
				| "treePathSeparator"
				| "idMember"
				| "pathMember"
				| "parentPathMember"
				| "levelMember"
				| "hasChildrenMember"
				| "isExpandedMember"
				| "isSelectedMember"
				| "isDraggableMember"
				| "isDropAllowedMember"
				| "displayValueMember"
				| "getDisplayValueCallback"
				| "searchValueMember"
				| "getSearchValueCallback"
				| "orderMember"
				| "isSorted"
				| "sortCallback"
				| "data"
				| "selectedNode"
				| "expandLevel"
				| "shouldToggleOnNodeClick"
				| "shouldUseInternalSearchIndex"
				| "initializeIndexCallback"
				| "searchText"
				| "indexerBatchSize"
				| "indexerTimeout"
				| "shouldDisplayDebugInformation"
				| "shouldDisplayContextMenuInDebugMode"
				| "onNodeClicked"
				| "onNodeDragStart"
				| "onNodeDragOver"
				| "beforeDropCallback"
				| "onNodeDrop"
				| "contextMenuCallback"
				| "dragDropMode"
				| "dropZoneMode"
				| "bodyClass"
				| "expandIconClass"
				| "collapseIconClass"
				| "leafIconClass"
				| "selectedNodeClass"
				| "dragOverNodeClass"
				| "scrollHighlightTimeout"
				| "scrollHighlightClass"
				| "contextMenuXOffset"
				| "contextMenuYOffset"
				| "virtualScroll"
				| "virtualRowHeight"
				| "virtualOverscan"
				| "virtualContainerHeight"
			>
		>
	) {
		if (updates.treeId !== undefined) treeId = updates.treeId;
		if (updates.treePathSeparator !== undefined) treePathSeparator = updates.treePathSeparator;
		if (updates.idMember !== undefined) idMember = updates.idMember;
		if (updates.pathMember !== undefined) pathMember = updates.pathMember;
		if (updates.parentPathMember !== undefined) parentPathMember = updates.parentPathMember;
		if (updates.levelMember !== undefined) levelMember = updates.levelMember;
		if (updates.hasChildrenMember !== undefined) hasChildrenMember = updates.hasChildrenMember;
		if (updates.isExpandedMember !== undefined) isExpandedMember = updates.isExpandedMember;
		if (updates.isSelectedMember !== undefined) isSelectedMember = updates.isSelectedMember;
		if (updates.isDraggableMember !== undefined) isDraggableMember = updates.isDraggableMember;
		if (updates.isDropAllowedMember !== undefined) isDropAllowedMember = updates.isDropAllowedMember;
		if (updates.displayValueMember !== undefined) displayValueMember = updates.displayValueMember;
		if (updates.getDisplayValueCallback !== undefined) getDisplayValueCallback = updates.getDisplayValueCallback;
		if (updates.searchValueMember !== undefined) searchValueMember = updates.searchValueMember;
		if (updates.getSearchValueCallback !== undefined) getSearchValueCallback = updates.getSearchValueCallback;
		if (updates.orderMember !== undefined) orderMember = updates.orderMember;
		if (updates.isSorted !== undefined) isSorted = updates.isSorted;
		if (updates.sortCallback !== undefined) sortCallback = updates.sortCallback;
		if (updates.data !== undefined) data = updates.data;
		if (updates.selectedNode !== undefined) selectedNode = updates.selectedNode;
		if (updates.expandLevel !== undefined) expandLevel = updates.expandLevel;
		if (updates.shouldToggleOnNodeClick !== undefined) shouldToggleOnNodeClick = updates.shouldToggleOnNodeClick;
		if (updates.shouldUseInternalSearchIndex !== undefined) shouldUseInternalSearchIndex = updates.shouldUseInternalSearchIndex;
		if (updates.initializeIndexCallback !== undefined) initializeIndexCallback = updates.initializeIndexCallback;
		if (updates.searchText !== undefined) searchText = updates.searchText;
		if (updates.indexerBatchSize !== undefined) indexerBatchSize = updates.indexerBatchSize;
		if (updates.indexerTimeout !== undefined) indexerTimeout = updates.indexerTimeout;
		if (updates.shouldDisplayDebugInformation !== undefined) shouldDisplayDebugInformation = updates.shouldDisplayDebugInformation;
		if (updates.shouldDisplayContextMenuInDebugMode !== undefined) shouldDisplayContextMenuInDebugMode = updates.shouldDisplayContextMenuInDebugMode;
		if (updates.onNodeClicked !== undefined) onNodeClicked = updates.onNodeClicked;
		if (updates.onNodeDragStart !== undefined) onNodeDragStart = updates.onNodeDragStart;
		if (updates.onNodeDragOver !== undefined) onNodeDragOver = updates.onNodeDragOver;
		if (updates.beforeDropCallback !== undefined) beforeDropCallback = updates.beforeDropCallback;
		if (updates.onNodeDrop !== undefined) onNodeDrop = updates.onNodeDrop;
		if (updates.contextMenuCallback !== undefined) contextMenuCallback = updates.contextMenuCallback;
		if (updates.dragDropMode !== undefined) dragDropMode = updates.dragDropMode;
		if (updates.dropZoneMode !== undefined) dropZoneMode = updates.dropZoneMode;
		if (updates.bodyClass !== undefined) bodyClass = updates.bodyClass;
		if (updates.expandIconClass !== undefined) expandIconClass = updates.expandIconClass;
		if (updates.collapseIconClass !== undefined) collapseIconClass = updates.collapseIconClass;
		if (updates.leafIconClass !== undefined) leafIconClass = updates.leafIconClass;
		if (updates.selectedNodeClass !== undefined) selectedNodeClass = updates.selectedNodeClass;
		if (updates.dragOverNodeClass !== undefined) dragOverNodeClass = updates.dragOverNodeClass;
		if (updates.scrollHighlightTimeout !== undefined) scrollHighlightTimeout = updates.scrollHighlightTimeout;
		if (updates.scrollHighlightClass !== undefined) scrollHighlightClass = updates.scrollHighlightClass;
		if (updates.contextMenuXOffset !== undefined) contextMenuXOffset = updates.contextMenuXOffset;
		if (updates.contextMenuYOffset !== undefined) contextMenuYOffset = updates.contextMenuYOffset;
		if (updates.virtualScroll !== undefined) virtualScroll = updates.virtualScroll;
		if (updates.virtualRowHeight !== undefined) virtualRowHeight = updates.virtualRowHeight;
		if (updates.virtualOverscan !== undefined) virtualOverscan = updates.virtualOverscan;
		if (updates.virtualContainerHeight !== undefined) virtualContainerHeight = updates.virtualContainerHeight;
	}

	treeId = treeId || generateTreeId();


	// svelte-ignore non_reactive_update
	const tree: Ltree<T> = createLTree<T>(
		idMember,
		pathMember,
		parentPathMember,
		levelMember,
		hasChildrenMember,

		isExpandedMember,
		isSelectedMember,
		isDraggableMember,
		isDropAllowedMember,
		allowedDropPositionsMember,

		displayValueMember,
		getDisplayValueCallback,
		searchValueMember,
		getSearchValueCallback,
		getAllowedDropPositionsCallback,
		orderMember,
		treeId,
		treePathSeparator,

		expandLevel,

		shouldUseInternalSearchIndex,
		initializeIndexCallback,
		indexerBatchSize,
		indexerTimeout,
		{
			shouldDisplayDebugInformation,
			isSorted,
			sortCallback
		}
	);

	// Update tree separator when prop changes
	$effect(() => {
		tree.treePathSeparator = treePathSeparator;
	});

	setContext('Ltree', tree);

	// Create stable callback references to avoid inline arrow functions causing re-renders
	// These are defined as a plain object with function references, not new functions each render
	const nodeCallbacks: NodeCallbacks<T> = {
		onNodeClicked: _onNodeClicked,
		onNodeRightClicked: _onNodeRightClicked,
		onNodeDragStart: _onNodeDragStart,
		onNodeDragOver: _onNodeDragOver,
		onNodeDragLeave: _onNodeDragLeave,
		onNodeDrop: _onNodeDrop,
		onZoneDrop: _onZoneDrop,
		onTouchDragStart: _onTouchStart,
		onTouchDragMove: _onTouchMove,
		onTouchDragEnd: _onTouchEnd,
	};
	setContext('NodeCallbacks', nodeCallbacks);

	// Note: NodeConfig is set via $effect below since it depends on reactive props

	// Create and provide render coordinator for progressive rendering (recursive mode)
	// Process only 2 nodes per frame - each node renders initialBatchSize children
	// This prevents too many reactive updates per frame
	const renderCoordinator = progressiveRender ? createRenderCoordinator(2, {
		onStart: () => {
			isRendering = true;
			onRenderStart?.();
		},
		onProgress: (stats) => {
			onRenderProgress?.(stats);
		},
		onComplete: (stats) => {
			isRendering = false;
			onRenderComplete?.(stats);
		}
	}) : null;
	if (renderCoordinator) {
		setContext('RenderCoordinator', renderCoordinator);
	}

	// Create stable config object - updated when props change
	// Using $state.raw to avoid deep reactivity on the config object itself
	let nodeConfig = $state.raw<NodeConfig>({
		shouldToggleOnNodeClick: shouldToggleOnNodeClick ?? true,
		expandIconClass: expandIconClass ?? 'ltree-icon-expand',
		collapseIconClass: collapseIconClass ?? 'ltree-icon-collapse',
		leafIconClass: leafIconClass ?? 'ltree-icon-leaf',
		selectedNodeClass,
		dragOverNodeClass,
		dropZoneMode: dropZoneMode ?? 'glow',
		dropZoneLayout: dropZoneLayout ?? 'around',
		dropZoneStart: dropZoneStart ?? 33,
		dropZoneMaxWidth: dropZoneMaxWidth ?? 120,
		allowCopy: allowCopy ?? false,
	});
	setContext('NodeConfig', nodeConfig);

	// Update config when props change (rarely happens, but supports dynamic updates)
	$effect(() => {
		nodeConfig = {
			shouldToggleOnNodeClick: shouldToggleOnNodeClick ?? true,
			expandIconClass: expandIconClass ?? 'ltree-icon-expand',
			collapseIconClass: collapseIconClass ?? 'ltree-icon-collapse',
			leafIconClass: leafIconClass ?? 'ltree-icon-leaf',
			selectedNodeClass,
			dragOverNodeClass,
			dropZoneMode: dropZoneMode ?? 'glow',
			dropZoneLayout: dropZoneLayout ?? 'around',
			dropZoneStart: dropZoneStart ?? 33,
			dropZoneMaxWidth: dropZoneMaxWidth ?? 120,
			allowCopy: allowCopy ?? false,
		};
	});

	$effect(() => {
		tree.filterNodes(searchText);
	});

	$effect(() => {
		if (tree && data) {
			if (untrack(() => _skipInsertArray)) {
				_skipInsertArray = false; // Reset for next time
				return;
			}
			// Reset progressive render coordinator when data changes
			renderCoordinator?.reset();
			// Reset flat progressive render state when data changes
			flatRenderedIds = new Set();
			flatRenderQueue = [];
			currentBatchSize = 0; // Reset exponential batch size
			// Reset virtual scroll measurements
			vsMeasuredRowHeight = null;
			vsDetectedHeight = null;
			insertResult = tree.insertArray(data);
		}
	});

	// Progressive rendering for flat mode - detect new nodes and queue them
	// Use a separate tracker to avoid reactive loops (effect reads AND writes flatRenderedIds)
	let lastFlatNodesTracker: Symbol | null = null;

	$effect(() => {
		if (!useFlatRendering || !progressiveRender || !tree?.visibleFlatNodes) return;

		// Only react to changeTracker changes, not to our own state updates
		const tracker = tree.changeTracker;
		if (tracker === lastFlatNodesTracker) return;
		lastFlatNodesTracker = tracker;

		const allNodes = tree.visibleFlatNodes;
		const currentIds = new Set(allNodes.map(n => n.id));

		// Snapshot current state to avoid reactive reads during computation
		const renderedSnapshot = new Set(flatRenderedIds);
		const queueSnapshot = new Set(flatRenderQueue);

		// Find new nodes (in current but not yet rendered AND not already queued)
		const newIds: string[] = [];
		for (const node of allNodes) {
			if (!renderedSnapshot.has(node.id) && !queueSnapshot.has(node.id)) {
				newIds.push(node.id);
			}
		}

		// Find removed nodes (rendered but no longer in current)
		const removedIds: string[] = [];
		for (const id of renderedSnapshot) {
			if (!currentIds.has(id)) {
				removedIds.push(id);
			}
		}

		// Remove nodes that are no longer visible
		if (removedIds.length > 0) {
			const newRendered = new Set(renderedSnapshot);
			for (const id of removedIds) {
				newRendered.delete(id);
			}
			flatRenderedIds = newRendered;
		}

		// Queue new nodes for progressive rendering
		if (newIds.length > 0) {
			// If we already have many rendered nodes and adding few new ones,
			// skip progressive batching to minimize Svelte diffs (expand/collapse case)
			const alreadyHasManyNodes = renderedSnapshot.size > 1000;
			const addingFewNodes = newIds.length < 200;

			if (alreadyHasManyNodes && addingFewNodes) {
				// Add all at once - one diff is faster than multiple diffs on large arrays
				flatRenderedIds = new Set([...flatRenderedIds, ...newIds]);
			} else {
				// Progressive batching for initial load (exponential: 20 → 40 → 80 → 160...)
				currentBatchSize = initialBatchSize; // Start with initial batch size
				const immediateBatch = newIds.slice(0, currentBatchSize);
				const remaining = newIds.slice(currentBatchSize);

				if (immediateBatch.length > 0) {
					flatRenderedIds = new Set([...flatRenderedIds, ...immediateBatch]);
				}

				// Double batch size for next iteration (capped at maxBatchSize)
				currentBatchSize = Math.min(currentBatchSize * 2, maxBatchSize);

				if (remaining.length > 0) {
					flatRenderQueue = [...remaining]; // Replace queue, don't append
					scheduleFlatRenderBatch();
				}
			}
		}
	});

	// Process flat render queue in batches (exponential sizing)
	function scheduleFlatRenderBatch() {
		if (flatRenderAnimationFrame) return; // Already scheduled

		flatRenderAnimationFrame = requestAnimationFrame(() => {
			flatRenderAnimationFrame = null;

			if (flatRenderQueue.length === 0) return;

			const batchSize = currentBatchSize || initialBatchSize;
			const batch = flatRenderQueue.slice(0, batchSize);
			const remaining = flatRenderQueue.slice(batchSize);

			flatRenderedIds = new Set([...flatRenderedIds, ...batch]);
			flatRenderQueue = remaining;

			// Double batch size for next iteration (capped at maxBatchSize)
			currentBatchSize = Math.min(batchSize * 2, maxBatchSize);

			if (remaining.length > 0) {
				scheduleFlatRenderBatch();
			}
		});
	}

	// Derived: all flat nodes (with progressive render filter if active)
	const allFlatNodes = $derived(
		useFlatRendering && progressiveRender
			? tree?.visibleFlatNodes?.filter(n => flatRenderedIds.has(n.id)) ?? []
			: tree?.visibleFlatNodes ?? []
	);

	// Virtual scrolling derived computations
	const vsRowHeight = $derived(virtualRowHeight ?? vsMeasuredRowHeight ?? 32);
	const vsActive = $derived(virtualScroll && useFlatRendering);
	const vsContainerStyle = $derived(
		virtualContainerHeight ?? vsDetectedHeight ?? '400px'
	);
	const vsTotalCount = $derived(allFlatNodes.length);
	const vsTotalHeight = $derived(vsTotalCount * vsRowHeight);
	const vsStartIndex = $derived(
		vsActive
			? Math.max(0, Math.floor(vsScrollTop / vsRowHeight) - virtualOverscan)
			: 0
	);
	const vsEndIndex = $derived(
		vsActive
			? Math.min(vsTotalCount,
				Math.ceil((vsScrollTop + (vsContainerRef?.clientHeight ?? 0)) / vsRowHeight) + virtualOverscan)
			: vsTotalCount
	);
	const vsOffsetY = $derived(vsStartIndex * vsRowHeight);

	// Final nodes to render — virtual window or all
	const flatNodesToRender = $derived(
		vsActive ? allFlatNodes.slice(vsStartIndex, vsEndIndex) : allFlatNodes
	);

	// Virtual scroll: rAF-throttled scroll handler
	let vsRafPending = false;
	function handleVirtualScroll(event: Event) {
		if (vsRafPending) return;
		vsRafPending = true;
		requestAnimationFrame(() => {
			vsScrollTop = (event.target as HTMLElement).scrollTop;
			vsRafPending = false;
		});
	}

	// Auto-measure row height from first rendered node
	$effect(() => {
		if (!vsActive || virtualRowHeight || vsMeasuredRowHeight) return;
		if (allFlatNodes.length === 0) return;
		tick().then(() => {
			if (vsContainerRef) {
				const firstNode = vsContainerRef.querySelector('.ltree-node');
				if (firstNode) {
					const height = firstNode.getBoundingClientRect().height;
					if (height > 0) vsMeasuredRowHeight = height;
				}
			}
		});
	});

	// Auto-detect container height from parent element
	$effect(() => {
		if (!vsActive || virtualContainerHeight || vsDetectedHeight) return;
		tick().then(() => {
			if (vsContainerRef?.parentElement) {
				const parentHeight = vsContainerRef.parentElement.clientHeight;
				if (parentHeight > 100) {
					vsDetectedHeight = parentHeight + 'px';
				}
			}
		});
	});

	// $inspect("tree change tracker", tree?.changeTracker?.toString());

	function generateTreeId(): string {
		return `${Date.now()}${Math.floor(Math.random() * 10000)}`;
	}

	async function _onNodeClicked(node: LTreeNode<T>) {
		// Close context menu when clicking on any node
		if (contextMenuVisible) {
			closeContextMenu();
		}

		const previousPath = selectedNode?.path;
		if (selectedNode) {
			const previousNode = tree.getNodeByPath(selectedNode.path);
			if (previousNode) {
				previousNode.isSelected = false;
				tree.bumpNodeRev(previousNode);
			} else selectedNode = null;
		}

		node.isSelected = true;
		tree.bumpNodeRev(node);
		selectedNode = node;

		uiLogger.debug(`Node selected: ${node.path}`, {
			previousPath,
			newPath: node.path,
			id: node.id
		});

		onNodeClicked?.(node);
		// NO tree.refresh() — fine-grained signals handle re-rendering
	}

	function _onNodeRightClicked(node: LTreeNode<T>, event: MouseEvent) {
		if (!contextMenu && !contextMenuCallback) {
			return;
		}

		uiLogger.debug(`Context menu opened: ${node.path}`);
		event.preventDefault();
		contextMenuNode = node;
		contextMenuX = event.clientX + contextMenuXOffset;
		contextMenuY = event.clientY + contextMenuYOffset;
		contextMenuVisible = true;
		isDebugMenuActive = false; // This is a user-triggered menu, not debug menu
	}


	// Check if drop is allowed based on dragDropMode
	function isDropAllowedByMode(draggedNodeTreeId: string | undefined): boolean {
		if (dragDropMode === 'none') return false;

		const isSameTree = draggedNodeTreeId === treeId;

		if (dragDropMode === 'self' && !isSameTree) return false;
		if (dragDropMode === 'cross' && isSameTree) return false;

		return true;
	}

	// Calculate drop position based on mouse Y relative to node
	function calculateDropPosition(event: DragEvent | MouseEvent, element: Element): DropPosition {
		const rect = element.getBoundingClientRect();
		const y = event.clientY - rect.top;
		const height = rect.height;

		if (y < height * 0.25) return 'above';
		if (y > height * 0.75) return 'below';
		return 'child';
	}

	function _onNodeDragStart(node: LTreeNode<T>, event: DragEvent) {
		dragLogger.debug(`Drag started: ${node.path}`, {
			ctrlKey: event.ctrlKey,
			allowCopy,
			treeId
		});
		draggedNode = node;
		isDragInProgress = true;
		onNodeDragStart?.(node, event);
	}

	function _onNodeDragEnd(event: DragEvent) {
		dragLogger.debug('Drag ended', {
			dropEffect: event.dataTransfer?.dropEffect,
			operation: currentDropOperation
		});
		isDragInProgress = false;
		draggedNode = null;
		hoveredNodeForDrop = null;
		activeDropPosition = null;
		isDropPlaceholderActive = false;
		currentDropOperation = 'move';
	}

	/**
	 * Helper to handle beforeDropCallback and onNodeDrop callbacks
	 * Returns true if drop was processed, false if cancelled
	 *
	 * Same-tree moves are auto-handled by default - the library calls moveNode() internally.
	 * onNodeDrop is still called for notification/logging purposes.
	 */
	async function _handleDrop(dropNode: LTreeNode<T> | null, draggedNode: LTreeNode<T>, position: DropPosition, event: DragEvent | TouchEvent): Promise<boolean> {
		// Determine operation based on Ctrl key and allowCopy setting
		// Touch events always use 'move' (no Ctrl key on mobile)
		let operation: DropOperation = 'move';
		const isDragEvent = event instanceof DragEvent;
		const ctrlKey = isDragEvent ? event.ctrlKey : false;

		if (allowCopy && isDragEvent && ctrlKey) {
			operation = 'copy';
		}

		dragLogger.info(`Drop: ${draggedNode.path} -> ${dropNode?.path ?? 'empty tree'}`, {
			position,
			operation,
			isCrossTree: draggedNode.treeId !== treeId
		});

		// Call beforeDropCallback if provided (supports async for dialogs)
		if (beforeDropCallback) {
			const result = await beforeDropCallback(dropNode, draggedNode, position, event, operation);
			if (result === false) {
				// Drop cancelled
				return false;
			}
			if (result && typeof result === 'object') {
				// Position and/or operation override
				if ('position' in result && result.position) {
					position = result.position;
				}
				if ('operation' in result && result.operation) {
					operation = result.operation;
				}
			}
		}

		// AUTO-HANDLE: Same-tree move operations
		const isSameTreeDrag = draggedNode.treeId === treeId;
		if (isSameTreeDrag && operation === 'move' && dropNode) {
			const result = moveNode(draggedNode.path, dropNode.path, position);
			// Still call onNodeDrop for notification/logging
			onNodeDrop?.(dropNode, draggedNode, position, event, operation);
			return result.success;
		}

		// AUTO-HANDLE: Same-tree copy operations (if enabled)
		if (isSameTreeDrag && operation === 'copy' && dropNode && autoHandleCopy) {
			// Calculate target parent and sibling based on position
			const targetParentPath = position === 'child' ? dropNode.path : (dropNode.parentPath || '');
			const siblingPath = position !== 'child' ? dropNode.path : undefined;
			const copyPosition = position !== 'child' ? position : undefined;

			// Copy with a transform that generates new IDs
			const result = tree.copyNodeWithDescendants(
				draggedNode,
				targetParentPath,
				(data) => ({
					...data,
					// Generate new ID - user can override via beforeDropCallback if needed
					[tree.idMember || 'id']: `${(data as any)[tree.idMember || 'id']}_copy_${Date.now()}`
				}),
				siblingPath,
				copyPosition
			);
			// Still call onNodeDrop for notification/logging
			onNodeDrop?.(dropNode, draggedNode, position, event, operation);
			return result.success;
		}

		// Cross-tree drags - user handles in onNodeDrop
		onNodeDrop?.(dropNode, draggedNode, position, event, operation);
		return true;
	}

	function _onNodeDragOver(node: LTreeNode<T>, event: DragEvent) {
		// For cross-tree drag, draggedNode might be null in THIS tree - parse from dataTransfer
		let effectiveDraggedNode = draggedNode;
		let isCrossTreeDrag = false;
		if (!effectiveDraggedNode && event.dataTransfer?.types.includes("application/svelte-treeview")) {
			isCrossTreeDrag = true;
			// Cross-tree drag - try to get node info from dataTransfer
			try {
				const data = event.dataTransfer.getData("application/svelte-treeview");
				if (data) {
					effectiveDraggedNode = JSON.parse(data);
				}
			} catch (e) {
				// getData might fail during dragover in some browsers, that's ok
			}
			// Even if we can't get the data, we know a drag is in progress
			isDragInProgress = true;
		}

		// Check if drop is allowed by mode
		// For cross-tree drags, we allow if mode is 'both' or 'cross', regardless of whether we could parse the node
		const dropAllowed = isCrossTreeDrag
			? (dragDropMode === 'both' || dragDropMode === 'cross')
			: isDropAllowedByMode(effectiveDraggedNode?.treeId);

		if (!dropAllowed) {
			hoveredNodeForDrop = null;  // Clear hover to prevent glow on invalid targets
			return;
		}

		// Set hoveredNodeForDrop if:
		// 1. We have drag data AND it's a different node (or from different tree), OR
		// 2. We know a drag is in progress (cross-tree where we can't read data yet)
		const isValidDrop = effectiveDraggedNode
			? (isCrossTreeDrag || effectiveDraggedNode.path !== node.path)
			: isDragInProgress; // For cross-tree, trust isDragInProgress

		if (isValidDrop) {
			event.preventDefault();

			// Update hovered node and calculate position
			hoveredNodeForDrop = node;
			const nodeElement = (event.target as Element).closest('.ltree-node-content');
			if (nodeElement) {
				activeDropPosition = calculateDropPosition(event, nodeElement);
			}

			// Update current operation based on Ctrl key
			currentDropOperation = (allowCopy && event.ctrlKey) ? 'copy' : 'move';

			onNodeDragOver?.(node, event);

			// Set visual feedback based on operation
			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = currentDropOperation;
			}
		}
	}

	function _onNodeDragLeave(node: LTreeNode<T>, event: DragEvent) {
		// Don't clear hoveredNodeForDrop here - let dragover on other nodes handle it
		// This prevents the zones from flickering when moving between nodes
	}

	function _onNodeDrop(node: LTreeNode<T>, event: DragEvent) {
		event.preventDefault();

		let isCrossTreeDrag = false;
		if (!draggedNode) {
			const data = event.dataTransfer?.getData('application/svelte-treeview');
			if (data) {
				draggedNode = JSON.parse(data);
				isCrossTreeDrag = draggedNode?.treeId !== treeId;
			}
		}

		// Check if drop is allowed by mode
		const dropAllowed = isCrossTreeDrag
			? (dragDropMode === 'both' || dragDropMode === 'cross')
			: isDropAllowedByMode(draggedNode?.treeId);

		if (!dropAllowed) {
			_onNodeDragEnd(event);
			return;
		}

		// For cross-tree, always allow; for same-tree, check it's not the same node
		if (draggedNode && (isCrossTreeDrag || draggedNode !== node)) {
			// Use the calculated position, default to 'child'
			const position = activeDropPosition || 'child';
			_handleDrop(node, draggedNode, position, event);
		}

		// Reset drag state
		_onNodeDragEnd(event);
	}

	// Zone drop handler - receives explicit position from drop zone panels
	function _onZoneDrop(node: LTreeNode<T>, position: DropPosition, event: DragEvent) {
		event.preventDefault();

		let isCrossTreeDrag = false;
		if (!draggedNode) {
			const data = event.dataTransfer?.getData('application/svelte-treeview');
			if (data) {
				draggedNode = JSON.parse(data);
				isCrossTreeDrag = draggedNode?.treeId !== treeId;
			}
		}

		if (!draggedNode) {
			_onNodeDragEnd(event);
			return;
		}

		// Check if drop is allowed by mode
		const dropAllowed = isCrossTreeDrag
			? (dragDropMode === 'both' || dragDropMode === 'cross')
			: isDropAllowedByMode(draggedNode?.treeId);

		if (!dropAllowed) {
			_onNodeDragEnd(event);
			return;
		}

		// For cross-tree, always allow; for same-tree, check it's not the same node
		if (isCrossTreeDrag || draggedNode !== node) {
			_handleDrop(node, draggedNode, position, event);
		}

		// Reset drag state
		_onNodeDragEnd(event);
	}

	// Touch drag handlers for mobile support
	function _onTouchStart(node: LTreeNode<any>, event: TouchEvent) {
		if (!node?.isDraggable) return;

		const touch = event.touches[0];
		touchDragState = {
			node,
			startX: touch.clientX,
			startY: touch.clientY,
			isDragging: false,
			ghostElement: null,
			currentDropTarget: null
		};

		// Start long-press timer (300ms)
		touchTimer = setTimeout(() => {
			touchDragState.isDragging = true;
			draggedNode = node;
			dragLogger.debug(`Touch drag started: ${node.path}`);
			createGhostElement(node, touch.clientX, touch.clientY);
			navigator.vibrate?.(50); // Haptic feedback
		}, 300);
	}

	function _onTouchMove(node: LTreeNode<any>, event: TouchEvent) {
		if (!touchDragState.node) return;

		const touch = event.touches[0];

		if (!touchDragState.isDragging) {
			// Check if moved too much before long-press completed - cancel drag
			const dx = Math.abs(touch.clientX - touchDragState.startX);
			const dy = Math.abs(touch.clientY - touchDragState.startY);
			if (dx > 10 || dy > 10) {
				if (touchTimer) clearTimeout(touchTimer);
				touchDragState = { node: null, startX: 0, startY: 0, isDragging: false, ghostElement: null, currentDropTarget: null };
			}
			return;
		}

		event.preventDefault(); // Prevent scroll during drag

		// Move ghost element
		if (touchDragState.ghostElement) {
			touchDragState.ghostElement.style.left = `${touch.clientX}px`;
			touchDragState.ghostElement.style.top = `${touch.clientY}px`;
		}

		// Find drop target under touch point (hide ghost temporarily to not interfere)
		if (touchDragState.ghostElement) {
			touchDragState.ghostElement.style.pointerEvents = 'none';
		}
		const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
		if (touchDragState.ghostElement) {
			touchDragState.ghostElement.style.pointerEvents = '';
		}

		// Update drop target highlighting
		updateDropTarget(elementUnderTouch);
	}

	function _onTouchEnd(node: LTreeNode<any>, event: TouchEvent) {
		if (touchTimer) clearTimeout(touchTimer);

		if (touchDragState.isDragging && draggedNode) {
			const touch = event.changedTouches[0];

			// Hide ghost to find element underneath
			if (touchDragState.ghostElement) {
				touchDragState.ghostElement.style.display = 'none';
			}

			const dropElement = document.elementFromPoint(touch.clientX, touch.clientY);
			const dropNode = findNodeFromElement(dropElement);

			// Check if dropping on empty tree placeholder
			const placeholder = dropElement?.closest('.ltree-empty-state');
			const rootDropZone = dropElement?.closest('.ltree-root-drop-zone');
			if ((placeholder || rootDropZone) && !dropNode) {
				// Dropping on empty tree or root drop zone
				dragLogger.debug(`Touch drag ended: ${draggedNode.path} -> empty tree`);
				_handleDrop(null, draggedNode, 'child', event);
			} else if (dropNode && dropNode !== draggedNode && dropNode.isDropAllowed) {
				// For touch, default to 'child' since we don't track position during touch
				dragLogger.debug(`Touch drag ended: ${draggedNode.path} -> ${dropNode.path}`);
				_handleDrop(dropNode, draggedNode, 'child', event);
			} else {
				dragLogger.debug(`Touch drag cancelled: ${draggedNode.path}`);
			}

			// Clean up ghost element
			removeGhostElement();
			clearDropTargetHighlight();
		}

		// Reset state
		touchDragState = { node: null, startX: 0, startY: 0, isDragging: false, ghostElement: null, currentDropTarget: null };
		draggedNode = null;
		isDropPlaceholderActive = false;
	}

	function createGhostElement(node: LTreeNode<any>, x: number, y: number) {
		const ghost = document.createElement('div');
		ghost.className = 'ltree-touch-ghost';
		ghost.textContent = tree.getNodeDisplayValue(node);
		ghost.style.left = `${x}px`;
		ghost.style.top = `${y}px`;
		document.body.appendChild(ghost);
		touchDragState.ghostElement = ghost;
	}

	function removeGhostElement() {
		if (touchDragState.ghostElement) {
			touchDragState.ghostElement.remove();
			touchDragState.ghostElement = null;
		}
	}

	function findNodeFromElement(element: Element | null): LTreeNode<any> | null {
		if (!element) return null;

		const nodeElement = element.closest('.ltree-node');
		if (!nodeElement) return null;

		const path = nodeElement.getAttribute('data-tree-path');
		if (!path) return null;

		return tree.getNodeByPath(path);
	}

	function updateDropTarget(element: Element | null) {
		const newTarget = findNodeFromElement(element);

		// Clear previous highlight
		if (touchDragState.currentDropTarget && touchDragState.currentDropTarget !== newTarget) {
			const prevElement = document.querySelector(`[data-tree-path="${touchDragState.currentDropTarget.path}"] .ltree-node-content`);
			prevElement?.classList.remove(dragOverNodeClass || 'ltree-dragover-highlight');
		}

		// Check if we're over an empty tree placeholder
		const placeholder = element?.closest('.ltree-empty-state');
		if (placeholder && !newTarget) {
			// We're over an empty tree's drop zone
			isDropPlaceholderActive = true;
			touchDragState.currentDropTarget = null;
			return;
		} else {
			// Clear placeholder state if we're not over it
			isDropPlaceholderActive = false;
		}

		// Add highlight to new target
		if (newTarget && newTarget !== draggedNode && newTarget.isDropAllowed) {
			const targetElement = document.querySelector(`[data-tree-path="${newTarget.path}"] .ltree-node-content`);
			targetElement?.classList.add(dragOverNodeClass || 'ltree-dragover-highlight');
			touchDragState.currentDropTarget = newTarget;
		} else {
			touchDragState.currentDropTarget = null;
		}
	}

	function clearDropTargetHighlight() {
		if (touchDragState.currentDropTarget) {
			const element = document.querySelector(`[data-tree-path="${touchDragState.currentDropTarget.path}"] .ltree-node-content`);
			element?.classList.remove(dragOverNodeClass || 'ltree-dragover-highlight');
		}
	}

	// Empty tree drop handlers
	function handleEmptyTreeDragOver(event: DragEvent) {
		if (event.dataTransfer?.types.includes("application/svelte-treeview")) {
			event.preventDefault();
			isDropPlaceholderActive = true;
			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = 'move';
			}
		}
	}

	function handleEmptyTreeDragLeave(event: DragEvent) {
		// Only deactivate if truly leaving the element
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = event.clientX;
		const y = event.clientY;

		if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
			isDropPlaceholderActive = false;
		}
	}

	function handleEmptyTreeDrop(event: DragEvent) {
		event.preventDefault();
		isDropPlaceholderActive = false;

		const draggedNodeData = event.dataTransfer?.getData('application/svelte-treeview');
		if (draggedNodeData) {
			const droppedNode = JSON.parse(draggedNodeData);
			// Call onNodeDrop with null as dropNode to indicate "root level drop"
			_handleDrop(null, droppedNode, 'child', event);
		}
		_onNodeDragEnd(event);
	}

	function handleEmptyTreeTouchEnd(event: TouchEvent) {
		// Check if touch drag was active and we have a dragged node
		if (draggedNode && isDropPlaceholderActive) {
			_handleDrop(null, draggedNode, 'child', event);
			isDropPlaceholderActive = false;
		}
	}

	// Tree-level dragenter for cross-tree drag detection
	function handleTreeDragEnter(event: DragEvent) {
		if (event.dataTransfer?.types.includes("application/svelte-treeview")) {
			isDragInProgress = true;
		}
	}

	function handleTreeDragLeave(event: DragEvent) {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = event.clientX;
		const y = event.clientY;

		// Only reset if truly leaving the tree container
		if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
			// Don't reset isDragInProgress if we're the source tree
			if (draggedNode?.treeId !== treeId) {
				isDragInProgress = false;
				hoveredNodeForDrop = null;
				activeDropPosition = null;
			}
		}
	}

	// Close context menu when clicking outside
	function handleDocumentClick(event: MouseEvent) {
		if (contextMenuVisible) {
			const target = event.target as Element;
			if (!target.closest('.ltree-context-menu')) {
				closeContextMenu();
			}
		}
	}

	// Add global event listener for document clicks and scroll events
	$effect(() => {
		if (contextMenuVisible) {
			const handleGlobalClick = (event: MouseEvent) => {
				const target = event.target as Element;
				if (!target.closest('.ltree-context-menu')) {
					closeContextMenu();
				}
			};

			const handleGlobalScroll = (event?: Event) => {
				closeContextMenu();
			};

			// Add scroll listeners to both window and document to catch all scroll events
			document.addEventListener('click', handleGlobalClick);
			document.addEventListener('contextmenu', handleGlobalClick);
			window.addEventListener('scroll', handleGlobalScroll, true);
			document.addEventListener('scroll', handleGlobalScroll, true);

			// Also listen for wheel events which might not trigger scroll
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

	// Debug context menu - show context menu on second node for styling development
	let isDebugMenuActive = $state(false);
	let treeContainerRef: HTMLDivElement;

	$effect(() => {
		if (shouldDisplayContextMenuInDebugMode && (contextMenu || contextMenuCallback) && tree?.tree && tree.tree.length > 0) {
			// Use the first available node for the context menu data
			const targetNode = tree.tree.length > 1 ? tree.tree[1] : tree.tree[0];
			if (targetNode && treeContainerRef) {
				// Position the context menu relative to the tree container
				const treeRect = treeContainerRef.getBoundingClientRect();
				contextMenuNode = targetNode;
				contextMenuX = treeRect.left + 200; // 200px from tree's left edge
				contextMenuY = treeRect.top + 100;  // 100px from tree's top edge
				contextMenuVisible = true;
				isDebugMenuActive = true;
			}
		} else if (!shouldDisplayContextMenuInDebugMode && isDebugMenuActive) {
			// Only hide the context menu if it was opened by debug mode
			contextMenuVisible = false;
			contextMenuNode = null;
			isDebugMenuActive = false;
		}
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="ltree-container"
	bind:this={treeContainerRef}
	ondragenter={handleTreeDragEnter}
	ondragleave={handleTreeDragLeave}
	ondragend={_onNodeDragEnd}
>
	{#if shouldDisplayDebugInformation}
		<div class="ltree-debug-info">
			<details>
				<summary>Debug Info</summary>
				<div class="ltree-debug-stats">
					<span>Tree: {treeId}</span>
					<span>Data: {data?.length || 0}</span>
					<span>Expand level: {expandLevel || 0}</span>
					<span>Nodes: {tree?.statistics.nodeCount || 0}</span>
					<span>Levels: {tree?.statistics.maxLevel || 0}</span>
					{#if tree?.statistics.filteredNodeCount > 0}
						<span>Filtered: {tree.statistics.filteredNodeCount}</span>
					{/if}
					{#if tree?.statistics.isIndexing}
						<span>Indexing: {tree.statistics.pendingIndexCount} pending</span>
					{/if}
					<span>Dragging: {draggedNode?.path || 'none'}</span>
				</div>
			</details>
		</div>
	{/if}

	{@render treeHeader?.()}

	{#if isLoading}
		<div class="ltree-loading-overlay">
			{#if loadingPlaceholder}
				{@render loadingPlaceholder()}
			{:else}
				<div class="ltree-loading-spinner"></div>
			{/if}
		</div>
	{/if}

	<div class={bodyClass}>
		{#if tree?.root}
			<!-- Flat rendering mode: no {#key} block, uses visibleFlatNodes for efficient updates -->
			{#if useFlatRendering}
				{#if vsActive}
					<!-- Virtual scrolling mode -->
					<div
						class="ltree-tree ltree-flat-mode ltree-virtual-scroll"
						style="height: {vsContainerStyle}; overflow-y: auto;"
						bind:this={vsContainerRef}
						onscroll={handleVirtualScroll}
					>
						<!-- Spacer for correct scrollbar -->
						<div style="height: {vsTotalHeight}px; position: relative;">
							<!-- Rendered window at correct offset -->
							<div style="transform: translateY({vsOffsetY}px);">
								{#each flatNodesToRender as node, i (node.id + '|' + node.path + '|' + node.hasChildren + '|' + node._rev)}
									{@const prevNode = (vsStartIndex + i) > 0 ? allFlatNodes[vsStartIndex + i - 1] : null}
									<Node
										{node}
										children={nodeTemplate}
										progressiveRender={false}
										isDraggedNode={draggedNode?.path === node.path}
										{isDragInProgress}
										hoveredNodeForDropPath={hoveredNodeForDrop?.path}
										{activeDropPosition}
										dropOperation={currentDropOperation}
										flatMode={true}
										flatGap={prevNode != null && node.level > prevNode.level}
									/>
								{:else}
									<!-- Empty state when tree has no items -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										class="ltree-empty-state"
										class:ltree-drop-placeholder={isDropPlaceholderActive}
										ondragenter={handleEmptyTreeDragOver}
										ondragover={handleEmptyTreeDragOver}
										ondragleave={handleEmptyTreeDragLeave}
										ondrop={handleEmptyTreeDrop}
										ontouchend={handleEmptyTreeTouchEnd}
									>
										{#if isDropPlaceholderActive}
											{#if dropPlaceholder}
												{@render dropPlaceholder()}
											{:else}
												<div class="ltree-drop-placeholder-content">
													Drop here to add
												</div>
											{/if}
										{:else}
											{@render noDataFound?.()}
										{/if}
									</div>
								{/each}
							</div>
						</div>
					</div>
				{:else}
					<!-- Non-virtual flat rendering -->
					<div class="ltree-tree ltree-flat-mode">
						{#each flatNodesToRender as node, i (node.id + '|' + node.path + '|' + node.hasChildren + '|' + node._rev)}
							{@const prevNode = i > 0 ? flatNodesToRender[i - 1] : null}
							<Node
								{node}
								children={nodeTemplate}
								progressiveRender={false}
								isDraggedNode={draggedNode?.path === node.path}
								{isDragInProgress}
								hoveredNodeForDropPath={hoveredNodeForDrop?.path}
								{activeDropPosition}
								dropOperation={currentDropOperation}
								flatMode={true}
								flatGap={prevNode != null && node.level > prevNode.level}
							/>
						{:else}
							<!-- Empty state when tree has no items -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="ltree-empty-state"
								class:ltree-drop-placeholder={isDropPlaceholderActive}
								ondragenter={handleEmptyTreeDragOver}
								ondragover={handleEmptyTreeDragOver}
								ondragleave={handleEmptyTreeDragLeave}
								ondrop={handleEmptyTreeDrop}
								ontouchend={handleEmptyTreeTouchEnd}
							>
								{#if isDropPlaceholderActive}
									{#if dropPlaceholder}
										{@render dropPlaceholder()}
									{:else}
										<div class="ltree-drop-placeholder-content">
											Drop here to add
										</div>
									{/if}
								{:else}
									{@render noDataFound?.()}
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			{:else}
				<!-- Recursive rendering mode: uses {#key} block for forced re-renders -->
				{#key tree.changeTracker}
					<div class="ltree-tree">
						{#each tree.tree as node (node.id)}
							<Node
								{node}
								children={nodeTemplate}
								{progressiveRender}
								renderBatchSize={initialBatchSize}
								isDraggedNode={draggedNode?.path === node.path}
								{isDragInProgress}
								hoveredNodeForDropPath={hoveredNodeForDrop?.path}
								{activeDropPosition}
								dropOperation={currentDropOperation}
							/>
						{:else}
							<!-- Empty state when tree has no items -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="ltree-empty-state"
								class:ltree-drop-placeholder={isDropPlaceholderActive}
								ondragenter={handleEmptyTreeDragOver}
								ondragover={handleEmptyTreeDragOver}
								ondragleave={handleEmptyTreeDragLeave}
								ondrop={handleEmptyTreeDrop}
								ontouchend={handleEmptyTreeTouchEnd}
							>
								{#if isDropPlaceholderActive}
									{#if dropPlaceholder}
										{@render dropPlaceholder()}
									{:else}
										<div class="ltree-drop-placeholder-content">
											Drop here to add
										</div>
									{/if}
								{:else}
									{@render noDataFound?.()}
								{/if}
							</div>
						{/each}
					</div>
				{/key}
			{/if}
		{:else}
			<!-- Empty tree drop zone -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="ltree-empty-state"
				class:ltree-drop-placeholder={isDropPlaceholderActive}
				ondragenter={handleEmptyTreeDragOver}
				ondragover={handleEmptyTreeDragOver}
				ondragleave={handleEmptyTreeDragLeave}
				ondrop={handleEmptyTreeDrop}
				ontouchend={handleEmptyTreeTouchEnd}
			>
				{#if isDropPlaceholderActive}
					{#if dropPlaceholder}
						{@render dropPlaceholder()}
					{:else}
						<div class="ltree-drop-placeholder-content">
							Drop here to add
						</div>
					{/if}
				{:else}
					{@render noDataFound?.()}
				{/if}
			</div>
		{/if}
	</div>

	{@render treeFooter?.()}

	<!-- Context Menu -->
	{#if contextMenuVisible && contextMenuNode}
		<div class="ltree-context-menu" style="left: {contextMenuX}px; top: {contextMenuY}px;">
			{#if contextMenuCallback}
				{@const menuItems = contextMenuCallback(contextMenuNode, closeContextMenu)}
				{#each menuItems as item}
					{#if item.isDivider}
						<div class="ltree-context-menu-divider"></div>
					{:else}
						<div
							class="ltree-context-menu-item {item.className || ''}"
							class:ltree-context-menu-item-disabled={item.isDisabled}
							role="menuitem"
							tabindex={item.isDisabled ? -1 : 0}
							onclick={async () => {
								if (!item.isDisabled) {
									try {
										await item.callback();
									} catch (error) {
										console.error('Context menu callback error:', error);
									}
								}
							}}
							onkeydown={async (e) => {
								if ((e.key === 'Enter' || e.key === ' ') && !item.isDisabled) {
									e.preventDefault();
									try {
										await item.callback();
									} catch (error) {
										console.error('Context menu callback error:', error);
									}
								}
							}}
						>
							{#if item.icon}
								<span class="ltree-context-menu-icon">{item.icon}</span>
							{/if}
							{item.title}
						</div>
					{/if}
				{/each}
			{:else if contextMenu}
				{@render contextMenu(contextMenuNode, closeContextMenu)}
			{/if}
		</div>
	{/if}
</div>
