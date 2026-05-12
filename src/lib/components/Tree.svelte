<script lang="ts" generics="T">
	import type { Index, SearchOptions } from 'flexsearch';
	import Node from './Node.svelte';
	import { type LTreeNode } from '../ltree/ltree-node.svelte.js';
	import {
		type InsertArrayResult,
		type InsertBranchResult,
		type DeleteBranchResult,
		type ContextMenuEntry,
		type DropPosition,
		type DragDropMode,
		type DropOperation,
		type ClickBehavior,
		type CheckboxMode,
		type TreeChange,
		type ApplyChangesResult
	} from '../ltree/types.js';
	import { setContext, onDestroy } from 'svelte';
	import type { RenderStats } from './RenderCoordinator.svelte.js';
	import { TreeController } from '../core/TreeController.svelte.js';
	import { createTreeController } from '../core/createTreeController.js';
	import type { TreeNavigationOverrides } from '../core/navigation.js';

	// NodeCallbacks and NodeConfig are now defined in ../core/TreeController.svelte.ts
	// and re-exported from index.ts for public consumption.

	interface Props {
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

		// For sibling ordering in drag-drop (before/after positioning)
		orderMember?: string | null | undefined;

		treeId?: string | null | undefined;
		treePathSeparator?: string | null | undefined;
		sortCallback?: (items: LTreeNode<T>[]) => LTreeNode<T>[];

		// DATA
		data: T[];
		focusedNode?: LTreeNode<T> | null | undefined;
		highlightedPaths?: Set<string>;
		selectedPaths?: Set<string>;
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
		clickBehavior?: ClickBehavior | null | undefined;
		showCheckboxes?: boolean | null | undefined;
		checkboxMode?: CheckboxMode | null | undefined;
		beforeCheckboxToggleCallback?: (node: LTreeNode<T>, checked: boolean, affectedPaths: string[]) => boolean | string[] | void;
		rangeSelectionMode?: 'visual' | 'logical';
		initializeIndexCallback?: () => Index;
		searchText?: string | null | undefined;
		shouldUseInternalSearchIndex?: boolean | null | undefined;
		indexerBatchSize?: number | null | undefined;
		indexerTimeout?: number | null | undefined;
		shouldDisplayDebugInformation?: boolean;
		shouldDisplayContextMenuInDebugMode?: boolean;
		isLoading?: boolean;

		// Progressive rendering (exponential batching: 20 → 40 → 80 → 160...)
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
		 * - Removing the {#key changeTracker} block that destroys all nodes on any change
		 * - Using a single flat loop instead of recursive component instantiation
		 * - Allowing Svelte's keyed {#each} to efficiently diff only changed nodes
		 */
		useFlatRendering?: boolean;

		// VIRTUAL SCROLLING (flat mode only)
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
		autoHandleMove?: boolean; // Auto-handle same-tree move operations (default: true). Set to false for database-first workflow.
		autoHandlePaste?: boolean; // Auto-handle paste operations (default: true). Set to false for database-first workflow.
		accordionExpand?: boolean; // Expanding a node auto-collapses its siblings (default: false)

		// EVENTS (on* = fire-and-forget notifications)
		onNodeClick?: (node: LTreeNode<T>) => void;
		onHighlightChange?: (paths: Set<string>, nodes: LTreeNode<T>[]) => void;
		onSelectionChange?: (paths: Set<string>, nodes: LTreeNode<T>[]) => void;
		onNodeDragStart?: (node: LTreeNode<T>, event: DragEvent) => void;
		onNodeDragOver?: (node: LTreeNode<T>, event: DragEvent) => void;
		onNodeDrop?: (dropNode: LTreeNode<T> | null, draggedNode: LTreeNode<T>, position: DropPosition, event: DragEvent | TouchEvent, operation: DropOperation) => void;

		// INTERCEPTORS (before*Callback = can modify/block)
		/**
		 * Called before a drop is processed. Return false to cancel the drop.
		 * Return { position, operation } to override the drop position or operation.
		 * Return true or undefined to proceed normally.
		 * Can be async - return a Promise to show dialogs or perform async validation.
		 */
		beforeDropCallback?: (dropNode: LTreeNode<T> | null, draggedNode: LTreeNode<T>, position: DropPosition, event: DragEvent | TouchEvent, operation: DropOperation) => boolean | { position?: DropPosition; operation?: DropOperation } | void | Promise<boolean | { position?: DropPosition; operation?: DropOperation } | void>;
		beforeCopyCallback?: (paths: string[]) => string[] | false | void;
		beforeCutCallback?: (paths: string[]) => string[] | false | void;
		beforePasteCallback?: (targetPath: string, operation: 'copy' | 'cut', entries: import('../core/clipboard.js').ClipboardEntry<T>[]) => { targetPath?: string; position?: 'child' | 'before' | 'after' } | false | void;

		// DATA PROVIDERS (get*Callback = returns data the system uses)
		getContextMenuItemsCallback?: (node: LTreeNode<T>, closeMenuCallback: () => void, selectedNodes?: LTreeNode<T>[]) => ContextMenuEntry[];

		// VISUALS
		bodyClass?: string | null | undefined;
		highlightedNodeClass?: string | null | undefined;
		focusedNodeClass?: string | null | undefined;
		dragOverNodeClass?: string | null | undefined;
		expandIconClass?: string | null | undefined;
		collapseIconClass?: string | null | undefined;
		leafIconClass?: string | null | undefined;
		toggleIconMode?: 'rotate' | 'swap';
		scrollHighlightTimeout?: number | null | undefined;
		scrollHighlightClass?: string | null | undefined;
		contextMenuXOffset?: number | null | undefined;
		contextMenuYOffset?: number | null | undefined;

		/** Custom keydown handler. Return true to prevent default tree keyboard handling. */
		onTreeKeydown?: (event: KeyboardEvent, controller: TreeController<T>) => boolean | void;

		/** Override individual navigation methods (e.g. for custom ArrowDown/Up behavior) */
		navigationOverrides?: TreeNavigationOverrides<T>;
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
		isSelectableMember,
		isSelectedMember,
		isDraggableMember,
		getIsDraggableCallback,
		isDropAllowedMember,
		allowedDropPositionsMember,
		getAllowedDropPositionsCallback,
		isCollapsibleMember,
		getIsCollapsibleCallback,

		displayValueMember,
		getDisplayValueCallback,
		searchValueMember,
		getSearchValueCallback,
		orderMember,
		isSorted,
		sortCallback,

		// DATA
		data = $bindable(),
		focusedNode = $bindable(),
		highlightedPaths = $bindable(new Set<string>()),
		selectedPaths = $bindable(new Set<string>()),
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

		clickBehavior = 'expand-and-focus',
		showCheckboxes = false,
		checkboxMode = 'independent',
		beforeCheckboxToggleCallback,
		rangeSelectionMode = 'visual',
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
		autoHandleMove = true,
		autoHandlePaste = true,
		accordionExpand = false,

		// EVENTS
		onNodeClick,
		onHighlightChange,
		onSelectionChange,
		onNodeDragStart,
		onNodeDragOver,
		onNodeDrop,
		// INTERCEPTORS
		beforeDropCallback,
		beforeCopyCallback,
		beforeCutCallback,
		beforePasteCallback,
		// DATA PROVIDERS
		getContextMenuItemsCallback,

		// VISUALS
		bodyClass,
		expandIconClass = 'ltree-icon-expand',
		collapseIconClass = 'ltree-icon-collapse',
		leafIconClass = 'ltree-icon-leaf',
		toggleIconMode = 'rotate',
		highlightedNodeClass,
		focusedNodeClass,
		dragOverNodeClass,
		scrollHighlightTimeout = 4000,
		scrollHighlightClass = 'ltree-scroll-highlight',
		contextMenuXOffset = 8,
		contextMenuYOffset = 0,
		onTreeKeydown,
		navigationOverrides
	}: Props = $props();

	// ── Create controller ───────────────────────────────────────────────
	const controller = createTreeController<T>({
		idMember,
		pathMember,
		parentPathMember,
		levelMember,
		hasChildrenMember,
		isExpandedMember,
		isSelectableMember,
		isSelectedMember,
		isDraggableMember,
		getIsDraggableCallback,
		isDropAllowedMember,
		allowedDropPositionsMember,
		getAllowedDropPositionsCallback,
		isCollapsibleMember,
		getIsCollapsibleCallback,
		displayValueMember,
		getDisplayValueCallback,
		searchValueMember,
		getSearchValueCallback,
		orderMember,
		isSorted,
		sortCallback,
		treeId,
		treePathSeparator,
		data,
		focusedNode,
		highlightedPaths,
		selectedPaths,
		expandLevel,
		clickBehavior,
		showCheckboxes,
		checkboxMode,
		beforeCheckboxToggleCallback,
		rangeSelectionMode,
		shouldUseInternalSearchIndex,
		initializeIndexCallback,
		searchText,
		indexerBatchSize,
		indexerTimeout,
		shouldDisplayDebugInformation,
		shouldDisplayContextMenuInDebugMode,
		isLoading,
		progressiveRender,
		initialBatchSize,
		maxBatchSize,
		onRenderStart,
		onRenderProgress,
		onRenderComplete,
		useFlatRendering,
		virtualScroll,
		virtualRowHeight,
		virtualOverscan,
		virtualContainerHeight,
		dragDropMode,
		dropZoneMode,
		dropZoneLayout,
		dropZoneStart,
		dropZoneMaxWidth,
		allowCopy,
		autoHandleCopy,
		autoHandleMove,
		autoHandlePaste,
		accordionExpand,
		onNodeClick,
		onHighlightChange,
		onSelectionChange,
		onNodeDragStart,
		onNodeDragOver,
		onNodeDrop,
		beforeDropCallback,
		beforeCopyCallback,
		beforeCutCallback,
		beforePasteCallback,
		getContextMenuItemsCallback,
		hasContextMenuSnippet: !!contextMenu,
		bodyClass,
		highlightedNodeClass,
		focusedNodeClass,
		dragOverNodeClass,
		expandIconClass,
		collapseIconClass,
		leafIconClass,
		toggleIconMode,
		scrollHighlightTimeout,
		scrollHighlightClass,
		contextMenuXOffset,
		contextMenuYOffset,
	});

	// ── Apply navigation overrides if provided ─────────────────────────
	if (navigationOverrides) {
		controller.navigation = { ...controller.createDefaultNavigation(), ...navigationOverrides };
	}

	// ── Set contexts (must happen synchronously during component init) ──
	setContext('Ltree', controller.tree);
	setContext('NodeCallbacks', controller.nodeCallbacks);
	setContext('NodeConfig', controller.nodeConfig);
	if (controller.renderCoordinator) {
		setContext('RenderCoordinator', controller.renderCoordinator);
	}

	// ── Cleanup on destroy ──────────────────────────────────────────────
	onDestroy(() => controller.destroy());

	// ── Bind container element for controller ───────────────────────────
	let treeContainerRef: HTMLDivElement;
	$effect(() => {
		if (treeContainerRef) {
			controller.containerElement = treeContainerRef;
		}
	});

	// ── Sync props → controller (one-way: parent prop changes flow in) ─
	$effect(() => { controller.data = data; });
	$effect(() => { controller.searchText = searchText; });
	$effect(() => { if (treeId) controller.treeId = treeId; });
	$effect(() => { controller.treePathSeparator = treePathSeparator ?? '.'; });
	$effect(() => { controller.shouldDisplayDebugInformation = shouldDisplayDebugInformation ?? false; });
	$effect(() => { controller.shouldDisplayContextMenuInDebugMode = shouldDisplayContextMenuInDebugMode ?? false; });
	$effect(() => { controller.isLoading = isLoading ?? false; });
	$effect(() => { controller.bodyClass = bodyClass; });
	$effect(() => { controller.useFlatRendering = useFlatRendering ?? true; });
	$effect(() => { controller.virtualScroll = virtualScroll ?? false; });
	$effect(() => { controller.virtualRowHeight = virtualRowHeight; });
	$effect(() => { controller.virtualOverscan = virtualOverscan ?? 5; });
	$effect(() => { controller.virtualContainerHeight = virtualContainerHeight; });
	$effect(() => { controller.progressiveRender = progressiveRender ?? true; });
	$effect(() => { controller.initialBatchSize = initialBatchSize ?? 20; });
	$effect(() => { controller.maxBatchSize = maxBatchSize ?? 500; });
	$effect(() => { controller.dragDropMode = dragDropMode ?? 'none'; });
	$effect(() => { controller.allowCopy = allowCopy ?? false; });
	$effect(() => { controller.autoHandleCopy = autoHandleCopy ?? true; });
	$effect(() => { controller.autoHandleMove = autoHandleMove ?? true; });
	$effect(() => { controller.autoHandlePaste = autoHandlePaste ?? true; });
	$effect(() => { controller.accordionExpand = accordionExpand ?? false; });
	$effect(() => { controller.hasContextMenuSnippet = !!contextMenu; });

	// Visual config sync (drives nodeConfig update via controller's internal effect)
	$effect(() => { controller.clickBehavior = clickBehavior ?? 'expand-and-focus'; });
	$effect(() => { controller.showCheckboxes = showCheckboxes ?? false; });
	$effect(() => { controller.checkboxMode = checkboxMode ?? 'independent'; });
	$effect(() => { controller.beforeCheckboxToggleHandler = beforeCheckboxToggleCallback; });
	$effect(() => { controller.rangeSelectionMode = rangeSelectionMode ?? 'visual'; });
	$effect(() => { controller.expandIconClass = expandIconClass ?? 'ltree-icon-expand'; });
	$effect(() => { controller.collapseIconClass = collapseIconClass ?? 'ltree-icon-collapse'; });
	$effect(() => { controller.leafIconClass = leafIconClass ?? 'ltree-icon-leaf'; });
	$effect(() => { controller.toggleIconMode = toggleIconMode ?? 'rotate'; });
	$effect(() => { controller.highlightedNodeClass = highlightedNodeClass; });
	$effect(() => { controller.focusedNodeClass = focusedNodeClass; });
	$effect(() => { controller.dragOverNodeClass = dragOverNodeClass; });
	$effect(() => { controller.dropZoneMode = dropZoneMode ?? 'glow'; });
	$effect(() => { controller.dropZoneLayout = dropZoneLayout ?? 'around'; });
	$effect(() => { controller.dropZoneStart = dropZoneStart ?? 33; });
	$effect(() => { controller.dropZoneMaxWidth = dropZoneMaxWidth ?? 120; });
	$effect(() => { controller.scrollHighlightTimeout = scrollHighlightTimeout ?? 4000; });
	$effect(() => { controller.scrollHighlightClass = scrollHighlightClass ?? 'ltree-scroll-highlight'; });
	$effect(() => { controller.contextMenuXOffset = contextMenuXOffset ?? 8; });
	$effect(() => { controller.contextMenuYOffset = contextMenuYOffset ?? 0; });

	// Callback sync
	$effect(() => { controller.onNodeClickHandler = onNodeClick; });
	$effect(() => { controller.onHighlightChangeHandler = onHighlightChange; });
	$effect(() => { controller.onSelectionChangeHandler = onSelectionChange; });
	$effect(() => { controller.onNodeDragStartHandler = onNodeDragStart; });
	$effect(() => { controller.onNodeDragOverHandler = onNodeDragOver; });
	$effect(() => { controller.onNodeDropHandler = onNodeDrop; });
	$effect(() => { controller.beforeDropHandler = beforeDropCallback; });
	$effect(() => { controller.beforeCopyHandler = beforeCopyCallback; });
	$effect(() => { controller.beforeCutHandler = beforeCutCallback; });
	$effect(() => { controller.beforePasteHandler = beforePasteCallback; });
	$effect(() => { controller.getContextMenuItemsHandler = getContextMenuItemsCallback; });
	$effect(() => { controller.onRenderStartHandler = onRenderStart; });
	$effect(() => { controller.onRenderProgressHandler = onRenderProgress; });
	$effect(() => { controller.onRenderCompleteHandler = onRenderComplete; });

	// ── Sync controller → bindable props (outputs flow back to parent) ──
	$effect(() => { focusedNode = controller.focusedNode; });
	$effect(() => { highlightedPaths = controller.highlightedPaths; });
	$effect(() => { selectedPaths = controller.selectedPaths; });
	$effect(() => { insertResult = controller.insertResult; });
	$effect(() => { isRendering = controller.isRendering; });

	// Bidirectional: parent can also SET these
	$effect(() => { controller.focusedNode = focusedNode; });
	$effect(() => {
		// Compare by size + content to avoid proxy identity loops
		const hp = highlightedPaths;
		const cp = controller.highlightedPaths;
		if (hp.size !== cp.size || [...hp].some(p => !cp.has(p))) {
			controller.highlightedPaths = new Set(hp);
		}
	});
	$effect(() => {
		const sp = selectedPaths;
		const cp = controller.selectedPaths;
		if (sp.size !== cp.size || [...sp].some(p => !cp.has(p))) {
			controller.selectedPaths = new Set(sp);
		}
	});

	// ── Floating drop zone helpers ───────────────────────────────────────
	const formattedDropZoneStart = $derived(
		typeof controller.dropZoneStart === 'number' ? `${controller.dropZoneStart}%` : controller.dropZoneStart
	);

	// ── Export public methods (thin proxies) ────────────────────────────
	export async function expandNodes(nodePath: string) {
		controller.expandNodes(nodePath);
	}

	export async function collapseNodes(nodePath: string) {
		controller.collapseNodes(nodePath);
	}

	export function expandAll(nodePath?: string | null | undefined) {
		controller.expandAll(nodePath);
	}

	export function collapseAll(nodePath?: string | null | undefined) {
		controller.collapseAll(nodePath);
	}

	export function filterNodes(searchTextVal: string, searchOptions?: SearchOptions): void {
		controller.filterNodes(searchTextVal, searchOptions);
	}

	export function searchNodes(
		searchTextVal: string | null | undefined,
		searchOptions?: SearchOptions
	): LTreeNode<T>[] {
		return controller.searchNodes(searchTextVal, searchOptions);
	}

	export function getChildren(parentPath: string): LTreeNode<T>[] {
		return controller.getChildren(parentPath);
	}

	export function getSiblings(path: string): LTreeNode<T>[] {
		return controller.getSiblings(path);
	}

	export function refreshSiblings(parentPath: string): void {
		controller.refreshSiblings(parentPath);
	}

	export function refreshNode(path: string): void {
		controller.refreshNode(path);
	}

	export function getNodeByPath(path: string): LTreeNode<T> | null {
		return controller.getNodeByPath(path);
	}

	export function moveNode(sourcePath: string, targetPath: string, position: 'before' | 'after' | 'child'): { success: boolean; error?: string } {
		return controller.moveNode(sourcePath, targetPath, position);
	}

	export function removeNode(path: string, includeDescendants: boolean = true): { success: boolean; node?: LTreeNode<T>; error?: string } {
		return controller.removeNode(path, includeDescendants);
	}

	export function addNode(parentPath: string, nodeData: T, pathSegment?: string): { success: boolean; node?: LTreeNode<T>; error?: string } {
		return controller.addNode(parentPath, nodeData, pathSegment);
	}

	export function updateNode(path: string, dataUpdates: Partial<T>): { success: boolean; node?: LTreeNode<T>; error?: string } {
		return controller.updateNode(path, dataUpdates);
	}

	export function applyChanges(changes: TreeChange<T>[]): ApplyChangesResult {
		return controller.applyChanges(changes);
	}

	export function insertBranch(parentPath: string, data: T[]): InsertBranchResult<T> {
		return controller.insertBranch(parentPath, data);
	}

	export function replaceBranch(parentPath: string, data: T[]): InsertBranchResult<T> {
		return controller.replaceBranch(parentPath, data);
	}

	export function deleteBranch(path: string, keepParent?: boolean): DeleteBranchResult<T> {
		return controller.deleteBranch(path, keepParent);
	}

	export function copyNodeWithDescendants(
		sourceNode: LTreeNode<T>,
		targetParentPath: string,
		transformData: (data: T) => T,
		siblingPath?: string,
		position?: 'before' | 'after'
	): { success: boolean; rootNode?: LTreeNode<T>; count: number; error?: string } {
		return controller.copyNodeWithDescendants(sourceNode, targetParentPath, transformData, siblingPath, position);
	}

	export function getExpandedPaths(): string[] {
		return controller.getExpandedPaths();
	}

	export function setExpandedPaths(paths: string[]): void {
		controller.setExpandedPaths(paths);
	}

	export function getAllData(): T[] {
		return controller.getAllData();
	}

	export function closeContextMenu() {
		controller.closeContextMenu();
	}

	// Multi-select methods
	export function selectNode(path: string, mode: 'replace' | 'toggle' | 'range' = 'replace') {
		controller.selectNode(path, mode);
	}

	export function selectNodes(paths: string[]) {
		controller.selectNodes(paths);
	}

	export function deselectAll() {
		controller.deselectAll();
	}

	export function getSelectedNodes(): LTreeNode<T>[] {
		return controller.getSelectedNodes();
	}

	export function isNodeSelected(path: string): boolean {
		return controller.isNodeSelected(path);
	}

	export async function scrollToPath(
		path: string,
		options?: {
			expand?: boolean;
			expandTarget?: boolean;
			highlight?: boolean;
			scrollOptions?: ScrollIntoViewOptions;
			containerScroll?: boolean;
		}
	): Promise<boolean> {
		return controller.scrollToPath(path, options);
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
				| "isSelectableMember"
				| "isSelectedMember"
				| "isDraggableMember"
				| "getIsDraggableCallback"
				| "isDropAllowedMember"
				| "displayValueMember"
				| "getDisplayValueCallback"
				| "searchValueMember"
				| "getSearchValueCallback"
				| "isCollapsibleMember"
				| "getIsCollapsibleCallback"
				| "orderMember"
				| "isSorted"
				| "sortCallback"
				| "data"
				| "focusedNode"
				| "highlightedPaths"
				| "selectedPaths"
				| "expandLevel"
				| "clickBehavior"
				| "showCheckboxes"
				| "checkboxMode"
				| "beforeCheckboxToggleCallback"
				| "rangeSelectionMode"
				| "shouldUseInternalSearchIndex"
				| "initializeIndexCallback"
				| "searchText"
				| "indexerBatchSize"
				| "indexerTimeout"
				| "shouldDisplayDebugInformation"
				| "shouldDisplayContextMenuInDebugMode"
				| "onNodeClick"
				| "onHighlightChange"
				| "onSelectionChange"
				| "onNodeDragStart"
				| "onNodeDragOver"
				| "onNodeDrop"
				| "beforeDropCallback"
				| "beforeCopyCallback"
				| "beforeCutCallback"
				| "beforePasteCallback"
				| "getContextMenuItemsCallback"
				| "virtualScroll"
				| "virtualRowHeight"
				| "virtualOverscan"
				| "virtualContainerHeight"
				| "dragDropMode"
				| "dropZoneMode"
				| "bodyClass"
				| "expandIconClass"
				| "collapseIconClass"
				| "leafIconClass"
				| "toggleIconMode"
				| "highlightedNodeClass"
				| "focusedNodeClass"
				| "dragOverNodeClass"
				| "scrollHighlightTimeout"
				| "scrollHighlightClass"
				| "contextMenuXOffset"
				| "contextMenuYOffset"
				| "accordionExpand"
			>
		>
	) {
		// Update local props (triggers $effect syncs to controller)
		if (updates.treeId !== undefined) treeId = updates.treeId;
		if (updates.treePathSeparator !== undefined) treePathSeparator = updates.treePathSeparator;
		if (updates.idMember !== undefined) idMember = updates.idMember;
		if (updates.pathMember !== undefined) pathMember = updates.pathMember;
		if (updates.parentPathMember !== undefined) parentPathMember = updates.parentPathMember;
		if (updates.levelMember !== undefined) levelMember = updates.levelMember;
		if (updates.hasChildrenMember !== undefined) hasChildrenMember = updates.hasChildrenMember;
		if (updates.isExpandedMember !== undefined) isExpandedMember = updates.isExpandedMember;
		if (updates.isSelectableMember !== undefined) isSelectableMember = updates.isSelectableMember;
		if (updates.isSelectedMember !== undefined) isSelectedMember = updates.isSelectedMember;
		if (updates.isDraggableMember !== undefined) isDraggableMember = updates.isDraggableMember;
		if (updates.getIsDraggableCallback !== undefined) getIsDraggableCallback = updates.getIsDraggableCallback;
		if (updates.isDropAllowedMember !== undefined) isDropAllowedMember = updates.isDropAllowedMember;
		if (updates.displayValueMember !== undefined) displayValueMember = updates.displayValueMember;
		if (updates.getDisplayValueCallback !== undefined) getDisplayValueCallback = updates.getDisplayValueCallback;
		if (updates.searchValueMember !== undefined) searchValueMember = updates.searchValueMember;
		if (updates.getSearchValueCallback !== undefined) getSearchValueCallback = updates.getSearchValueCallback;
		if (updates.isCollapsibleMember !== undefined) isCollapsibleMember = updates.isCollapsibleMember;
		if (updates.getIsCollapsibleCallback !== undefined) getIsCollapsibleCallback = updates.getIsCollapsibleCallback;
		if (updates.orderMember !== undefined) orderMember = updates.orderMember;
		if (updates.isSorted !== undefined) isSorted = updates.isSorted;
		if (updates.sortCallback !== undefined) sortCallback = updates.sortCallback;
		if (updates.data !== undefined) data = updates.data;
		if (updates.focusedNode !== undefined) focusedNode = updates.focusedNode;
		if (updates.highlightedPaths !== undefined) highlightedPaths = updates.highlightedPaths;
		if (updates.selectedPaths !== undefined) selectedPaths = updates.selectedPaths;
		if (updates.expandLevel !== undefined) expandLevel = updates.expandLevel;
		if (updates.clickBehavior !== undefined) clickBehavior = updates.clickBehavior;
		if (updates.showCheckboxes !== undefined) showCheckboxes = updates.showCheckboxes;
		if (updates.checkboxMode !== undefined) checkboxMode = updates.checkboxMode;
		if (updates.beforeCheckboxToggleCallback !== undefined) beforeCheckboxToggleCallback = updates.beforeCheckboxToggleCallback;
		if (updates.rangeSelectionMode !== undefined) rangeSelectionMode = updates.rangeSelectionMode;
		if (updates.shouldUseInternalSearchIndex !== undefined) shouldUseInternalSearchIndex = updates.shouldUseInternalSearchIndex;
		if (updates.initializeIndexCallback !== undefined) initializeIndexCallback = updates.initializeIndexCallback;
		if (updates.searchText !== undefined) searchText = updates.searchText;
		if (updates.indexerBatchSize !== undefined) indexerBatchSize = updates.indexerBatchSize;
		if (updates.indexerTimeout !== undefined) indexerTimeout = updates.indexerTimeout;
		if (updates.shouldDisplayDebugInformation !== undefined) shouldDisplayDebugInformation = updates.shouldDisplayDebugInformation;
		if (updates.shouldDisplayContextMenuInDebugMode !== undefined) shouldDisplayContextMenuInDebugMode = updates.shouldDisplayContextMenuInDebugMode;
		if (updates.onNodeClick !== undefined) onNodeClick = updates.onNodeClick;
		if (updates.onHighlightChange !== undefined) onHighlightChange = updates.onHighlightChange;
		if (updates.onSelectionChange !== undefined) onSelectionChange = updates.onSelectionChange;
		if (updates.onNodeDragStart !== undefined) onNodeDragStart = updates.onNodeDragStart;
		if (updates.onNodeDragOver !== undefined) onNodeDragOver = updates.onNodeDragOver;
		if (updates.onNodeDrop !== undefined) onNodeDrop = updates.onNodeDrop;
		if (updates.beforeDropCallback !== undefined) beforeDropCallback = updates.beforeDropCallback;
		if (updates.beforeCopyCallback !== undefined) beforeCopyCallback = updates.beforeCopyCallback;
		if (updates.beforeCutCallback !== undefined) beforeCutCallback = updates.beforeCutCallback;
		if (updates.beforePasteCallback !== undefined) beforePasteCallback = updates.beforePasteCallback;
		if (updates.getContextMenuItemsCallback !== undefined) getContextMenuItemsCallback = updates.getContextMenuItemsCallback;
		if (updates.virtualScroll !== undefined) virtualScroll = updates.virtualScroll;
		if (updates.virtualRowHeight !== undefined) virtualRowHeight = updates.virtualRowHeight;
		if (updates.virtualOverscan !== undefined) virtualOverscan = updates.virtualOverscan;
		if (updates.virtualContainerHeight !== undefined) virtualContainerHeight = updates.virtualContainerHeight;
		if (updates.dragDropMode !== undefined) dragDropMode = updates.dragDropMode;
		if (updates.dropZoneMode !== undefined) dropZoneMode = updates.dropZoneMode;
		if (updates.bodyClass !== undefined) bodyClass = updates.bodyClass;
		if (updates.expandIconClass !== undefined) expandIconClass = updates.expandIconClass;
		if (updates.collapseIconClass !== undefined) collapseIconClass = updates.collapseIconClass;
		if (updates.leafIconClass !== undefined) leafIconClass = updates.leafIconClass;
		if (updates.toggleIconMode !== undefined) toggleIconMode = updates.toggleIconMode;
		if (updates.highlightedNodeClass !== undefined) highlightedNodeClass = updates.highlightedNodeClass;
		if (updates.focusedNodeClass !== undefined) focusedNodeClass = updates.focusedNodeClass;
		if (updates.dragOverNodeClass !== undefined) dragOverNodeClass = updates.dragOverNodeClass;
		if (updates.scrollHighlightTimeout !== undefined) scrollHighlightTimeout = updates.scrollHighlightTimeout;
		if (updates.scrollHighlightClass !== undefined) scrollHighlightClass = updates.scrollHighlightClass;
		if (updates.contextMenuXOffset !== undefined) contextMenuXOffset = updates.contextMenuXOffset;
		if (updates.contextMenuYOffset !== undefined) contextMenuYOffset = updates.contextMenuYOffset;
		if (updates.accordionExpand !== undefined) accordionExpand = updates.accordionExpand;
	}

	// ── Arrow key navigation ─────────────────────────────────────────────
	function handleTreeKeydown(event: KeyboardEvent) {
		// Ignore modifier-only key presses (Ctrl, Shift, Alt, Meta)
		if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return;

		// Don't interfere with context menu keyboard handling
		if (controller.contextMenuVisible) return;

		// Call custom handler first — return true to suppress default handling
		if (onTreeKeydown?.(event, controller) === true) {
			event.preventDefault();
			return;
		}

		if (controller.allFlatNodes.length === 0) return;

		let handled = true;

		switch (event.key) {
			case 'ArrowDown':  event.shiftKey ? controller.navHighlightNext() : controller.navNextSibling(); break;
			case 'ArrowUp':    event.shiftKey ? controller.navHighlightPrev() : controller.navPrevSibling(); break;
			case 'ArrowRight': controller.navInto(); break;
			case 'ArrowLeft':  controller.navOut(); break;
			case 'Backspace':  controller.navBackOut(); break;
			case 'Home':       event.shiftKey ? controller.navHighlightFirst() : controller.navFirst(); break;
			case 'End':        event.shiftKey ? controller.navHighlightLast() : controller.navLast(); break;
			case 'PageDown':   event.shiftKey ? controller.navHighlightPageDown() : controller.navPageDown(); break;
			case 'PageUp':     event.shiftKey ? controller.navHighlightPageUp() : controller.navPageUp(); break;
			case 'Enter':
			case ' ':          controller.navToggle(); break;
			default:           handled = false;
		}

		if (handled) event.preventDefault();
	}

	// ── Context menu keyboard shortcut handling ──────────────────────────
	function parseShortcut(shortcut: string): { key: string; ctrl: boolean; shift: boolean; alt: boolean } {
		const parts = shortcut.split('+').map(p => p.trim());
		const key = parts.pop()!; // last part is the key
		return {
			key: key.toLowerCase(),
			ctrl: parts.some(p => p.toLowerCase() === 'ctrl'),
			shift: parts.some(p => p.toLowerCase() === 'shift'),
			alt: parts.some(p => p.toLowerCase() === 'alt'),
		};
	}

	function findEntryByShortcut(entries: ContextMenuEntry[], event: KeyboardEvent): import('../ltree/types.js').ContextMenuItem | null {
		for (const entry of entries) {
			if ('divider' in entry) continue;
			if (entry.isVisible === false || entry.isDisabled) continue;
			if (entry.shortcut) {
				const parsed = parseShortcut(entry.shortcut);
				const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
				if (eventKey === parsed.key && event.ctrlKey === parsed.ctrl && event.shiftKey === parsed.shift && event.altKey === parsed.alt) {
					return entry;
				}
			}
			// Search children (submenus) too
			if (entry.children) {
				const found = findEntryByShortcut(entry.children, event);
				if (found) return found;
			}
		}
		return null;
	}

	async function handleContextMenuKeydown(event: KeyboardEvent) {
		if (!controller.contextMenuVisible || !controller.contextMenuNode || !getContextMenuItemsCallback) return;

		if (event.key === 'Escape') {
			controller.closeContextMenu();
			return;
		}

		const entries = getContextMenuItemsCallback(controller.contextMenuNode, controller.closeContextMenu.bind(controller), controller.getSelectedNodes());
		const match = findEntryByShortcut(entries, event);
		if (match) {
			event.preventDefault();
			try {
				await match.onclick?.();
			} catch (error) {
				console.error('Context menu shortcut error:', error);
			}
		}
	}
</script>

<svelte:window onkeydown={handleContextMenuKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="ltree-container"
	tabindex="0"
	bind:this={treeContainerRef}
	onkeydown={handleTreeKeydown}
	ondragenter={controller.handleTreeDragEnter}
	ondragleave={controller.handleTreeDragLeave}
	ondragend={controller._onNodeDragEnd}
>
	{#if controller.shouldDisplayDebugInformation}
		<div class="ltree-debug-info">
			<details>
				<summary>Debug Info</summary>
				<div class="ltree-debug-stats">
					<span>Tree: {controller.treeId}</span>
					<span>Data: {controller.data?.length || 0}</span>
					<span>Expand level: {expandLevel || 0}</span>
					<span>Nodes: {controller.tree?.statistics.nodeCount || 0}</span>
					<span>Levels: {controller.tree?.statistics.maxLevel || 0}</span>
					{#if controller.tree?.statistics.filteredNodeCount > 0}
						<span>Filtered: {controller.tree.statistics.filteredNodeCount}</span>
					{/if}
					{#if controller.tree?.statistics.isIndexing}
						<span>Indexing: {controller.tree.statistics.pendingIndexCount} pending</span>
					{/if}
					<span>Dragging: {controller.draggedNode?.path || 'none'}</span>
				</div>
			</details>
		</div>
	{/if}

	{@render treeHeader?.()}

	{#if controller.isLoading}
		<div class="ltree-loading-overlay">
			{#if loadingPlaceholder}
				{@render loadingPlaceholder()}
			{:else}
				<div class="ltree-loading-spinner"></div>
			{/if}
		</div>
	{/if}

	<div class={controller.bodyClass}>
		{#if controller.tree?.root}
			{#if controller.vsActive}
				<!-- Virtual scrolling mode -->
				<div
					class="ltree-tree ltree-flat-mode ltree-virtual-scroll"
					style="height: {controller.vsContainerStyle}; overflow-y: auto;"
					bind:this={controller.vsContainerRef}
					onscroll={controller.handleVirtualScroll}
				>
					<!-- Spacer for correct scrollbar -->
					<div style="height: {controller.vsTotalHeight}px; position: relative;">
						<!-- Rendered window at correct offset -->
						<div style="transform: translateY({controller.vsOffsetY}px);">
							{#each controller.flatNodesToRender as node, i (node.id + '|' + node.path + '|' + node.hasChildren + '|' + node._rev)}
								{@const absoluteIndex = controller.vsStartIndex + i}
								{@const prevNode = absoluteIndex > 0 ? controller.allFlatNodes[absoluteIndex - 1] : null}
								<Node
									{node}
									children={nodeTemplate}
									progressiveRender={false}
									isDraggedNode={controller.draggedNode?.path === node.path}
									isDragInProgress={controller.isDragInProgress}
									hoveredNodeForDropPath={controller.hoveredNodeForDrop?.path}
									activeDropPosition={controller.activeDropPosition}
									dropOperation={controller.currentDropOperation}
									flatMode={true}
									flatGap={prevNode != null && (node.level ?? 0) > (prevNode.level ?? 0)}
								/>
							{:else}
								<!-- Empty state when tree has no items -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="ltree-empty-state"
									class:ltree-drop-placeholder={controller.isDropPlaceholderActive}
									ondragenter={controller.handleEmptyTreeDragOver}
									ondragover={controller.handleEmptyTreeDragOver}
									ondragleave={controller.handleEmptyTreeDragLeave}
									ondrop={controller.handleEmptyTreeDrop}
									ontouchend={controller.handleEmptyTreeTouchEnd}
								>
									{#if controller.isDropPlaceholderActive}
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
			{:else if controller.useFlatRendering}
				<!-- Flat rendering mode: no {#key} block, uses visibleFlatNodes for efficient updates -->
				<div class="ltree-tree ltree-flat-mode">
					{#each controller.flatNodesToRender as node, i (node.id + '|' + node.path + '|' + node.hasChildren + '|' + node._rev)}
						{@const prevNode = i > 0 ? controller.flatNodesToRender[i - 1] : null}
						<Node
							{node}
							children={nodeTemplate}
							progressiveRender={false}
							isDraggedNode={controller.draggedNode?.path === node.path}
							isDragInProgress={controller.isDragInProgress}
							hoveredNodeForDropPath={controller.hoveredNodeForDrop?.path}
							activeDropPosition={controller.activeDropPosition}
							dropOperation={controller.currentDropOperation}
							flatMode={true}
							flatGap={prevNode != null && (node.level ?? 0) > (prevNode.level ?? 0)}
						/>
					{:else}
						<!-- Empty state when tree has no items -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="ltree-empty-state"
							class:ltree-drop-placeholder={controller.isDropPlaceholderActive}
							ondragenter={controller.handleEmptyTreeDragOver}
							ondragover={controller.handleEmptyTreeDragOver}
							ondragleave={controller.handleEmptyTreeDragLeave}
							ondrop={controller.handleEmptyTreeDrop}
							ontouchend={controller.handleEmptyTreeTouchEnd}
						>
							{#if controller.isDropPlaceholderActive}
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
			{:else}
				<!-- Recursive rendering mode: uses {#key} block for forced re-renders -->
				{#key controller.tree.changeTracker}
					<div class="ltree-tree">
						{#each controller.tree.tree as node (node.id)}
							<Node
								{node}
								children={nodeTemplate}
								progressiveRender={controller.progressiveRender}
								renderBatchSize={controller.initialBatchSize}
								isDraggedNode={controller.draggedNode?.path === node.path}
								isDragInProgress={controller.isDragInProgress}
								hoveredNodeForDropPath={controller.hoveredNodeForDrop?.path}
								activeDropPosition={controller.activeDropPosition}
								dropOperation={controller.currentDropOperation}
							/>
						{:else}
							<!-- Empty state when tree has no items -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="ltree-empty-state"
								class:ltree-drop-placeholder={controller.isDropPlaceholderActive}
								ondragenter={controller.handleEmptyTreeDragOver}
								ondragover={controller.handleEmptyTreeDragOver}
								ondragleave={controller.handleEmptyTreeDragLeave}
								ondrop={controller.handleEmptyTreeDrop}
								ontouchend={controller.handleEmptyTreeTouchEnd}
							>
								{#if controller.isDropPlaceholderActive}
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
				class:ltree-drop-placeholder={controller.isDropPlaceholderActive}
				ondragenter={controller.handleEmptyTreeDragOver}
				ondragover={controller.handleEmptyTreeDragOver}
				ondragleave={controller.handleEmptyTreeDragLeave}
				ondrop={controller.handleEmptyTreeDrop}
				ontouchend={controller.handleEmptyTreeTouchEnd}
			>
				{#if controller.isDropPlaceholderActive}
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

	<!-- Floating Drop Zones (position:fixed overlay, escapes overflow:hidden) -->
	{#if controller.dropZoneMode === 'floating' && controller.isDragInProgress && controller.hoveredNodeForDrop && controller.floatingZoneRect}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="ltree-drop-zones ltree-drop-zones-{controller.dropZoneLayout}"
			style="position: fixed; top: {controller.floatingZoneRect.top}px; left: {controller.floatingZoneRect.left}px; width: {controller.floatingZoneRect.width}px; height: {controller.floatingZoneRect.height}px; z-index: 10000; --drop-zone-start: {formattedDropZoneStart}; --drop-zone-max-width: {controller.dropZoneMaxWidth}px;"
		>
			{#if controller.isFloatingPositionAllowed('before')}
				<div class="ltree-drop-zone ltree-drop-before"
					class:ltree-drop-zone-active={controller.floatingHoveredZone === 'before'}
					ondragover={(e) => controller.handleFloatingZoneDragOver('before', e)}
					ondragleave={() => controller.handleFloatingZoneDragLeave()}
					ondrop={(e) => controller.handleFloatingZoneDrop('before', e)}
				>↑ Before</div>
			{/if}
			{#if controller.isFloatingPositionAllowed('after')}
				<div class="ltree-drop-zone ltree-drop-after"
					class:ltree-drop-zone-active={controller.floatingHoveredZone === 'after'}
					ondragover={(e) => controller.handleFloatingZoneDragOver('after', e)}
					ondragleave={() => controller.handleFloatingZoneDragLeave()}
					ondrop={(e) => controller.handleFloatingZoneDrop('after', e)}
				>↓ After</div>
			{/if}
			{#if controller.isFloatingPositionAllowed('child')}
				<div class="ltree-drop-zone ltree-drop-child"
					class:ltree-drop-zone-active={controller.floatingHoveredZone === 'child'}
					ondragover={(e) => controller.handleFloatingZoneDragOver('child', e)}
					ondragleave={() => controller.handleFloatingZoneDragLeave()}
					ondrop={(e) => controller.handleFloatingZoneDrop('child', e)}
				>→ Child</div>
			{/if}
		</div>
	{/if}

	<!-- Context Menu -->
	{#if controller.contextMenuVisible && controller.contextMenuNode}
		<div class="ltree-context-menu" style="left: {controller.contextMenuX}px; top: {controller.contextMenuY}px;" role="menu">
			{#if getContextMenuItemsCallback}
				{@const menuEntries = getContextMenuItemsCallback(controller.contextMenuNode, controller.closeContextMenu.bind(controller), controller.getSelectedNodes())}
				{#snippet renderEntries(entries: ContextMenuEntry[])}
					{#each entries as entry}
						{#if 'divider' in entry}
							<div class="ltree-context-menu-divider" role="separator">
								{#if entry.label}
									<span class="ltree-context-menu-divider-label">{entry.label}</span>
								{/if}
							</div>
						{:else if entry.isVisible !== false}
							{@const hasChildren = entry.children && entry.children.length > 0}
							<div
								class="ltree-context-menu-item {entry.className || ''}"
								class:ltree-context-menu-item-disabled={entry.isDisabled}
								class:ltree-context-menu-has-children={hasChildren}
								role="menuitem"
								tabindex={entry.isDisabled ? -1 : 0}
								onclick={async () => {
									if (!entry.isDisabled && !hasChildren) {
										try {
											await entry.onclick?.();
										} catch (error) {
											console.error('Context menu callback error:', error);
										}
									}
								}}
								onkeydown={async (e) => {
									if ((e.key === 'Enter' || e.key === ' ') && !entry.isDisabled && !hasChildren) {
										e.preventDefault();
										try {
											await entry.onclick?.();
										} catch (error) {
											console.error('Context menu callback error:', error);
										}
									}
								}}
							>
								{#if entry.icon}
									<span class="ltree-context-menu-icon">{entry.icon}</span>
								{/if}
								<span class="ltree-context-menu-label">{entry.label}</span>
								{#if entry.shortcut}
									<span class="ltree-context-menu-shortcut">{entry.shortcut}</span>
								{/if}
								{#if hasChildren}
									<span class="ltree-context-menu-arrow">&#x25B8;</span>
									<div class="ltree-context-submenu" role="menu">
										{@render renderEntries(entry.children!)}
									</div>
								{/if}
							</div>
						{/if}
					{/each}
				{/snippet}
				{@render renderEntries(menuEntries)}
			{:else if contextMenu}
				{@render contextMenu(controller.contextMenuNode, controller.closeContextMenu.bind(controller))}
			{/if}
		</div>
	{/if}
</div>
