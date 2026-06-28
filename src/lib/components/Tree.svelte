<script lang="ts" generics="T">
	import type { Index, SearchOptions } from 'flexsearch';
	import Node from './Node.svelte';
	import ContextMenuLevel from './ContextMenuLevel.svelte';
	import { computePosition, autoUpdate, offset, flip, shift } from '@floating-ui/dom';
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
		type SelectionMode,
		type HighlightMode,
		type TreeMutationOptions,
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
		/**
		 * `'single'` (default): plain click highlights one node; Ctrl/Shift+click
		 * degrade to plain click; Shift+Arrow / Enter are no-ops.
		 * `'multi'`: Ctrl-toggle, Shift-range, Shift+Arrow extend, Enter toggles
		 * highlight on the focused node.
		 */
		selectionMode?: SelectionMode | null | undefined;
		shouldShowCheckboxes?: boolean | null | undefined;
		checkboxMode?: CheckboxMode | null | undefined;
		shouldClickToggleCheckbox?: boolean | null | undefined;
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
		isProgressiveRender?: boolean;
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
		isFlatRenderingEnabled?: boolean;

		// VIRTUAL SCROLLING (flat mode only)
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
		dropZoneMode?: 'floating' | 'glow'; // 'floating' = original floating zones, 'glow' = border glow indicators
		dropZoneLayout?: 'around' | 'above' | 'below' | 'wave' | 'wave2';
		dropZoneStart?: number | string; // number = percentage (0-100), string = any CSS value ("33%", "50px", "3rem")
		dropZoneMaxWidth?: number; // max width in pixels for wave layouts
		isCopyAllowed?: boolean; // Enable Ctrl+drag to copy instead of move (default: false)
		shouldAutoHandleCopy?: boolean; // Auto-handle same-tree copy operations (default: true). Set to false for external DB/API handling.
		shouldAutoHandleMove?: boolean; // Auto-handle same-tree move operations (default: true). Set to false for database-first workflow.
		shouldAutoHandlePaste?: boolean; // Auto-handle paste operations (default: true). Set to false for database-first workflow.
		isAccordionExpand?: boolean; // Expanding a node auto-collapses its siblings (default: false)

		// EVENTS (on* = fire-and-forget notifications)
		onNodeClick?: (node: LTreeNode<T>) => void;
		onNodeDoubleClick?: (node: LTreeNode<T>) => void;
		onHighlightChange?: (paths: Set<string>, nodes: LTreeNode<T>[]) => void;
		onSelectionChange?: (paths: Set<string>, nodes: LTreeNode<T>[]) => void;
		onNodeDragStart?: (node: LTreeNode<T>, event: DragEvent) => void;
		onNodeDragOver?: (node: LTreeNode<T>, event: DragEvent) => void;
		onNodeDrop?: (dropNode: LTreeNode<T> | null, draggedNode: LTreeNode<T>, position: DropPosition, event: DragEvent | TouchEvent, operation: DropOperation) => void;
		// Post-operation clipboard notifications (fired AFTER the op). onCopy/onCut
		// receive the final paths; onPaste receives the PasteResult.
		onCopy?: (paths: string[]) => void;
		onCut?: (paths: string[]) => void;
		onPaste?: (result: import('../core/TreeController.svelte.js').PasteResult<T>) => void;

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
		/** Per-instance theme override. Forwarded to the root `.stv__container`
		 *  as `data-theme="dark"|"light"`, which the stylesheet uses to flip the
		 *  tree's colors independently of the surrounding page. Leave undefined to
		 *  inherit from the page (OS preference, framework classes, etc.). */
		theme?: 'dark' | 'light' | null | undefined;
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
		getIsExpandedCallback,
		isSelectableMember,
		getIsSelectableCallback,
		isSelectedMember,
		getIsSelectedCallback,
		isDraggableMember,
		getIsDraggableCallback,
		isDropAllowedMember,
		getIsDropAllowedCallback,
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
		selectionMode = 'single',
		shouldShowCheckboxes = false,
		checkboxMode = 'independent',
		shouldClickToggleCheckbox = false,
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
		isProgressiveRender = true,
		initialBatchSize = 20,
		maxBatchSize = 500,
		isRendering = $bindable(false),
		onRenderStart,
		onRenderProgress,
		onRenderComplete,

		// Flat rendering mode
		isFlatRenderingEnabled = true,

		// Virtual scrolling (flat mode only)
		isVirtualScrollEnabled = false,
		virtualRowHeight = undefined,
		virtualOverscan = 5,
		virtualContainerHeight = undefined,

		// DRAG AND DROP
		dragDropMode = 'none',
		dropZoneMode = 'glow',
		dropZoneLayout = 'around',
		dropZoneStart = 33,
		dropZoneMaxWidth = 120,
		isCopyAllowed = false,
		shouldAutoHandleCopy = true,
		shouldAutoHandleMove = true,
		shouldAutoHandlePaste = true,
		isAccordionExpand = false,

		// EVENTS
		onNodeClick,
		onNodeDoubleClick,
		onHighlightChange,
		onSelectionChange,
		onNodeDragStart,
		onNodeDragOver,
		onNodeDrop,
		onCopy,
		onCut,
		onPaste,
		// INTERCEPTORS
		beforeDropCallback,
		beforeCopyCallback,
		beforeCutCallback,
		beforePasteCallback,
		// DATA PROVIDERS
		getContextMenuItemsCallback,

		// VISUALS
		theme,
		bodyClass,
		expandIconClass = 'stv__toggle-icon--expand',
		collapseIconClass = 'stv__toggle-icon--collapse',
		leafIconClass = 'stv__toggle-icon--leaf',
		toggleIconMode = 'rotate',
		highlightedNodeClass,
		focusedNodeClass,
		dragOverNodeClass,
		scrollHighlightTimeout = 4000,
		scrollHighlightClass = 'stv__node-content--scroll-highlight',
		contextMenuXOffset = 8,
		contextMenuYOffset = 0,
		onTreeKeydown,
		navigationOverrides
	}: Props = $props();

	// ── Create controller ───────────────────────────────────────────────
	// Each prop here captures its INITIAL value only — that's intentional. Every
	// reactive prop is re-synced into the controller via $effect blocks below
	// (search for "Sync props → controller"), so the controller stays in step
	// with parent changes. The svelte-ignore suppresses the 80+ warnings the
	// compiler would otherwise fire for each non-closure prop reference here.
	// svelte-ignore state_referenced_locally
	const controller = createTreeController<T>({
		idMember,
		pathMember,
		parentPathMember,
		levelMember,
		hasChildrenMember,
		isExpandedMember,
		getIsExpandedCallback,
		isSelectableMember,
		getIsSelectableCallback,
		isSelectedMember,
		getIsSelectedCallback,
		isDraggableMember,
		getIsDraggableCallback,
		isDropAllowedMember,
		getIsDropAllowedCallback,
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
		selectionMode,
		shouldShowCheckboxes,
		checkboxMode,
		shouldClickToggleCheckbox,
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
		isProgressiveRender,
		initialBatchSize,
		maxBatchSize,
		onRenderStart,
		onRenderProgress,
		onRenderComplete,
		isFlatRenderingEnabled,
		isVirtualScrollEnabled,
		virtualRowHeight,
		virtualOverscan,
		virtualContainerHeight,
		dragDropMode,
		dropZoneMode,
		dropZoneLayout,
		dropZoneStart,
		dropZoneMaxWidth,
		isCopyAllowed,
		shouldAutoHandleCopy,
		shouldAutoHandleMove,
		shouldAutoHandlePaste,
		isAccordionExpand,
		onNodeClick,
		onNodeDoubleClick,
		onHighlightChange,
		onSelectionChange,
		onNodeDragStart,
		onNodeDragOver,
		onNodeDrop,
		onCopy,
		onCut,
		onPaste,
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
	// Snapshot at init only — navigation handlers aren't expected to swap mid-
	// lifetime. Consumers passing a new object on rerender would not see it
	// applied; if that becomes a need, hoist into an $effect.
	// svelte-ignore state_referenced_locally
	if (navigationOverrides) {
		// svelte-ignore state_referenced_locally
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

	// ── Context menu element + Floating UI positioning ─────────────────
	let contextMenuEl = $state<HTMLDivElement | null>(null);
	$effect(() => {
		if (!controller.contextMenuVisible || !contextMenuEl) return;
		const xOff = controller.contextMenuXOffset ?? 0;
		const yOff = controller.contextMenuYOffset ?? 0;
		const virtualRef = {
			getBoundingClientRect: () => {
				const ax = controller.contextMenuX + xOff;
				const ay = controller.contextMenuY + yOff;
				return { x: ax, y: ay, width: 0, height: 0, top: ay, left: ax, right: ax, bottom: ay, toJSON() { return this; } };
			}
		};
		const menu = contextMenuEl;
		return autoUpdate(virtualRef, menu, () => {
			computePosition(virtualRef, menu, {
				strategy: 'fixed',
				placement: 'bottom-start',
				middleware: [offset(0), flip(), shift({ padding: 8 })]
			}).then(({ x, y }) => {
				menu.style.left = `${x}px`;
				menu.style.top = `${y}px`;
			});
		});
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
	$effect(() => { controller.isFlatRenderingEnabled = isFlatRenderingEnabled ?? true; });
	$effect(() => { controller.isVirtualScrollEnabled = isVirtualScrollEnabled ?? false; });
	$effect(() => { controller.virtualRowHeight = virtualRowHeight; });
	$effect(() => { controller.virtualOverscan = virtualOverscan ?? 5; });
	$effect(() => { controller.virtualContainerHeight = virtualContainerHeight; });
	$effect(() => { controller.isProgressiveRender = isProgressiveRender ?? true; });
	$effect(() => { controller.initialBatchSize = initialBatchSize ?? 20; });
	$effect(() => { controller.maxBatchSize = maxBatchSize ?? 500; });
	$effect(() => { controller.dragDropMode = dragDropMode ?? 'none'; });
	$effect(() => { controller.isCopyAllowed = isCopyAllowed ?? false; });
	$effect(() => { controller.shouldAutoHandleCopy = shouldAutoHandleCopy ?? true; });
	$effect(() => { controller.shouldAutoHandleMove = shouldAutoHandleMove ?? true; });
	$effect(() => { controller.shouldAutoHandlePaste = shouldAutoHandlePaste ?? true; });
	$effect(() => { controller.isAccordionExpand = isAccordionExpand ?? false; });
	$effect(() => { controller.hasContextMenuSnippet = !!contextMenu; });

	// Visual config sync (drives nodeConfig update via controller's internal effect)
	$effect(() => { controller.clickBehavior = clickBehavior ?? 'expand-and-focus'; });
	$effect(() => { controller.selectionMode = selectionMode ?? 'single'; });
	$effect(() => { controller.shouldShowCheckboxes = shouldShowCheckboxes ?? false; });
	$effect(() => { controller.checkboxMode = checkboxMode ?? 'independent'; });
	$effect(() => { controller.shouldClickToggleCheckbox = shouldClickToggleCheckbox ?? false; });
	$effect(() => { controller.beforeCheckboxToggleHandler = beforeCheckboxToggleCallback; });
	$effect(() => { controller.rangeSelectionMode = rangeSelectionMode ?? 'visual'; });
	$effect(() => { controller.expandIconClass = expandIconClass ?? 'stv__toggle-icon--expand'; });
	$effect(() => { controller.collapseIconClass = collapseIconClass ?? 'stv__toggle-icon--collapse'; });
	$effect(() => { controller.leafIconClass = leafIconClass ?? 'stv__toggle-icon--leaf'; });
	$effect(() => { controller.toggleIconMode = toggleIconMode ?? 'rotate'; });
	$effect(() => { controller.highlightedNodeClass = highlightedNodeClass; });
	$effect(() => { controller.focusedNodeClass = focusedNodeClass; });
	$effect(() => { controller.dragOverNodeClass = dragOverNodeClass; });
	$effect(() => { controller.dropZoneMode = dropZoneMode ?? 'glow'; });
	$effect(() => { controller.dropZoneLayout = dropZoneLayout ?? 'around'; });
	$effect(() => { controller.dropZoneStart = dropZoneStart ?? 33; });
	$effect(() => { controller.dropZoneMaxWidth = dropZoneMaxWidth ?? 120; });
	$effect(() => { controller.scrollHighlightTimeout = scrollHighlightTimeout ?? 4000; });
	$effect(() => { controller.scrollHighlightClass = scrollHighlightClass ?? 'stv__node-content--scroll-highlight'; });
	$effect(() => { controller.contextMenuXOffset = contextMenuXOffset ?? 8; });
	$effect(() => { controller.contextMenuYOffset = contextMenuYOffset ?? 0; });

	// Callback sync
	$effect(() => { controller.onNodeClickHandler = onNodeClick; });
	$effect(() => { controller.onNodeDoubleClickHandler = onNodeDoubleClick; });
	$effect(() => { controller.onHighlightChangeHandler = onHighlightChange; });
	$effect(() => { controller.onSelectionChangeHandler = onSelectionChange; });
	$effect(() => { controller.onNodeDragStartHandler = onNodeDragStart; });
	$effect(() => { controller.onNodeDragOverHandler = onNodeDragOver; });
	$effect(() => { controller.onNodeDropHandler = onNodeDrop; });
	$effect(() => { controller.onCopyHandler = onCopy; });
	$effect(() => { controller.onCutHandler = onCut; });
	$effect(() => { controller.onPasteHandler = onPaste; });
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
	export async function expandNodes(
		nodePath: string | string[],
		options?: { exclusive?: boolean; noEmit?: boolean }
	) {
		controller.expandNodes(nodePath, options);
	}

	export async function collapseNodes(
		nodePath: string | string[],
		options?: { noEmit?: boolean }
	) {
		controller.collapseNodes(nodePath, options);
	}

	export function expandAll(
		nodePath?: string | string[] | null | undefined,
		options?: { exclusive?: boolean; noEmit?: boolean }
	) {
		controller.expandAll(nodePath, options);
	}

	export function collapseAll(
		nodePath?: string | string[] | null | undefined,
		options?: { noEmit?: boolean }
	) {
		controller.collapseAll(nodePath, options);
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

	// ── Highlight set (UI multi-select — highlightedPaths) ──────────────
	export function highlightNode(path: string, mode: HighlightMode = 'replace', options?: TreeMutationOptions) {
		controller.highlightNode(path, mode, options);
	}

	export function highlightNodes(paths: string[], options?: TreeMutationOptions) {
		controller.highlightNodes(paths, options);
	}

	export function setHighlightedPaths(paths: string[], options?: TreeMutationOptions) {
		controller.setHighlightedPaths(paths, options);
	}

	export function highlightAll(options?: TreeMutationOptions) {
		controller.highlightAll(options);
	}

	export function clearHighlight(paths?: string[], options?: TreeMutationOptions) {
		controller.clearHighlight(paths, options);
	}

	// ── Selection set (checkbox / data state — selectedPaths) ───────────
	export function selectNode(path: string, options?: TreeMutationOptions) {
		controller.selectNode(path, options);
	}

	export function selectNodes(paths: string[], options?: TreeMutationOptions) {
		controller.selectNodes(paths, options);
	}

	export function setSelectedPaths(paths: string[], options?: TreeMutationOptions) {
		controller.setSelectedPaths(paths, options);
	}

	export function selectAll(options?: TreeMutationOptions) {
		controller.selectAll(options);
	}

	export function deselectNode(path: string, options?: TreeMutationOptions) {
		controller.deselectNode(path, options);
	}

	export function clearSelection(paths?: string[], options?: TreeMutationOptions) {
		controller.clearSelection(paths, options);
	}

	// ── Focus (single cursor — focusedNode) ─────────────────────────────
	export function focusNode(path: string, options?: TreeMutationOptions) {
		controller.focusNode(path, options);
	}

	export function clearFocus(options?: TreeMutationOptions) {
		controller.clearFocus(options);
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
				| "getIsExpandedCallback"
				| "isSelectableMember"
				| "getIsSelectableCallback"
				| "isSelectedMember"
				| "getIsSelectedCallback"
				| "isDraggableMember"
				| "getIsDraggableCallback"
				| "isDropAllowedMember"
				| "getIsDropAllowedCallback"
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
				| "selectionMode"
				| "shouldShowCheckboxes"
				| "checkboxMode"
				| "shouldClickToggleCheckbox"
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
				| "onNodeDoubleClick"
				| "onHighlightChange"
				| "onSelectionChange"
				| "onNodeDragStart"
				| "onNodeDragOver"
				| "onNodeDrop"
				| "onCopy"
				| "onCut"
				| "onPaste"
				| "beforeDropCallback"
				| "beforeCopyCallback"
				| "beforeCutCallback"
				| "beforePasteCallback"
				| "getContextMenuItemsCallback"
				| "isVirtualScrollEnabled"
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
				| "isAccordionExpand"
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
		if (updates.getIsExpandedCallback !== undefined) getIsExpandedCallback = updates.getIsExpandedCallback;
		if (updates.isSelectableMember !== undefined) isSelectableMember = updates.isSelectableMember;
		if (updates.getIsSelectableCallback !== undefined) getIsSelectableCallback = updates.getIsSelectableCallback;
		if (updates.isSelectedMember !== undefined) isSelectedMember = updates.isSelectedMember;
		if (updates.getIsSelectedCallback !== undefined) getIsSelectedCallback = updates.getIsSelectedCallback;
		if (updates.isDraggableMember !== undefined) isDraggableMember = updates.isDraggableMember;
		if (updates.getIsDraggableCallback !== undefined) getIsDraggableCallback = updates.getIsDraggableCallback;
		if (updates.isDropAllowedMember !== undefined) isDropAllowedMember = updates.isDropAllowedMember;
		if (updates.getIsDropAllowedCallback !== undefined) getIsDropAllowedCallback = updates.getIsDropAllowedCallback;
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
		if (updates.selectionMode !== undefined) selectionMode = updates.selectionMode;
		if (updates.shouldShowCheckboxes !== undefined) shouldShowCheckboxes = updates.shouldShowCheckboxes;
		if (updates.checkboxMode !== undefined) checkboxMode = updates.checkboxMode;
		if (updates.shouldClickToggleCheckbox !== undefined) shouldClickToggleCheckbox = updates.shouldClickToggleCheckbox;
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
		if (updates.onNodeDoubleClick !== undefined) onNodeDoubleClick = updates.onNodeDoubleClick;
		if (updates.onHighlightChange !== undefined) onHighlightChange = updates.onHighlightChange;
		if (updates.onSelectionChange !== undefined) onSelectionChange = updates.onSelectionChange;
		if (updates.onNodeDragStart !== undefined) onNodeDragStart = updates.onNodeDragStart;
		if (updates.onNodeDragOver !== undefined) onNodeDragOver = updates.onNodeDragOver;
		if (updates.onNodeDrop !== undefined) onNodeDrop = updates.onNodeDrop;
		if (updates.onCopy !== undefined) onCopy = updates.onCopy;
		if (updates.onCut !== undefined) onCut = updates.onCut;
		if (updates.onPaste !== undefined) onPaste = updates.onPaste;
		if (updates.beforeDropCallback !== undefined) beforeDropCallback = updates.beforeDropCallback;
		if (updates.beforeCopyCallback !== undefined) beforeCopyCallback = updates.beforeCopyCallback;
		if (updates.beforeCutCallback !== undefined) beforeCutCallback = updates.beforeCutCallback;
		if (updates.beforePasteCallback !== undefined) beforePasteCallback = updates.beforePasteCallback;
		if (updates.getContextMenuItemsCallback !== undefined) getContextMenuItemsCallback = updates.getContextMenuItemsCallback;
		if (updates.isVirtualScrollEnabled !== undefined) isVirtualScrollEnabled = updates.isVirtualScrollEnabled;
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
		if (updates.isAccordionExpand !== undefined) isAccordionExpand = updates.isAccordionExpand;
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

		// Shift+nav extends the highlight range. In single mode the controller
		// short-circuits these to no-ops (see _navHighlightTo).
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
				// single: no-op (per spec); multi: toggle highlight on focused node.
				if (controller.selectionMode === 'multi') controller.toggleFocusedHighlight();
				else handled = false;
				break;
			case ' ':
				// With checkboxes: toggle the focused node's checkbox.
				// Without: keep the legacy expand/collapse behaviour as a useful fallback.
				if (controller.shouldShowCheckboxes && controller.focusedNode?.isSelectable) {
					controller.nodeCallbacks.onCheckboxToggle(controller.focusedNode);
				} else {
					controller.navToggle();
				}
				break;
			case 'Escape':
				// Priority: pending cut → highlight set → leave alone for surrounding UI.
				// File Explorer / Finder convention. Context-menu Escape is handled by
				// the separate window-level listener above and never reaches this path.
				if (controller.hasClipboardContent() && controller.getClipboardOperation() === 'cut') {
					controller.cancelCut();
				} else if (controller.highlightedPaths.size > 0) {
					controller.clearHighlight();
				} else {
					handled = false;
				}
				break;
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
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="stv__container"
	tabindex="0"
	data-theme={theme}
	bind:this={treeContainerRef}
	onkeydown={handleTreeKeydown}
	ondragenter={controller.handleTreeDragEnter}
	ondragleave={controller.handleTreeDragLeave}
	ondragend={controller._onNodeDragEnd}
>
	{#if controller.shouldDisplayDebugInformation}
		<div class="stv__debug-info">
			<details>
				<summary>Debug Info</summary>
				<div class="stv__debug-stats">
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
		<div class="stv__loading-overlay">
			{#if loadingPlaceholder}
				{@render loadingPlaceholder()}
			{:else}
				<div class="stv__loading-spinner"></div>
			{/if}
		</div>
	{/if}

	<div class={controller.bodyClass}>
		{#if controller.tree?.root}
			{#if controller.vsActive}
				<!-- Virtual scrolling mode -->
				<div
					class="stv__tree stv__tree--flat stv__virtual-scroll"
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
									isProgressiveRender={false}
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
									class="stv__empty-state"
									class:stv__drop-placeholder={controller.isDropPlaceholderActive}
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
											<div class="stv__drop-placeholder-content">
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
			{:else if controller.isFlatRenderingEnabled}
				<!-- Flat rendering mode: no {#key} block, uses visibleFlatNodes for efficient updates -->
				<div class="stv__tree stv__tree--flat">
					{#each controller.flatNodesToRender as node, i (node.id + '|' + node.path + '|' + node.hasChildren + '|' + node._rev)}
						{@const prevNode = i > 0 ? controller.flatNodesToRender[i - 1] : null}
						<Node
							{node}
							children={nodeTemplate}
							isProgressiveRender={false}
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
							class="stv__empty-state"
							class:stv__drop-placeholder={controller.isDropPlaceholderActive}
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
									<div class="stv__drop-placeholder-content">
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
					<div class="stv__tree">
						{#each controller.tree.tree as node (node.id)}
							<Node
								{node}
								children={nodeTemplate}
								isProgressiveRender={controller.isProgressiveRender}
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
								class="stv__empty-state"
								class:stv__drop-placeholder={controller.isDropPlaceholderActive}
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
										<div class="stv__drop-placeholder-content">
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
				class="stv__empty-state"
				class:stv__drop-placeholder={controller.isDropPlaceholderActive}
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
						<div class="stv__drop-placeholder-content">
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
			class="stv__drop-zones stv__drop-zones--{controller.dropZoneLayout}"
			style="position: fixed; top: {controller.floatingZoneRect.top}px; left: {controller.floatingZoneRect.left}px; width: {controller.floatingZoneRect.width}px; height: {controller.floatingZoneRect.height}px; z-index: 10000; --drop-zone-start: {formattedDropZoneStart}; --drop-zone-max-width: {controller.dropZoneMaxWidth}px;"
		>
			{#if controller.isFloatingPositionAllowed('before')}
				<div class="stv__drop-zone stv__drop-zone--before"
					class:stv__drop-zone--active={controller.floatingHoveredZone === 'before'}
					ondragover={(e) => controller.handleFloatingZoneDragOver('before', e)}
					ondragleave={() => controller.handleFloatingZoneDragLeave()}
					ondrop={(e) => controller.handleFloatingZoneDrop('before', e)}
				>↑ Before</div>
			{/if}
			{#if controller.isFloatingPositionAllowed('after')}
				<div class="stv__drop-zone stv__drop-zone--after"
					class:stv__drop-zone--active={controller.floatingHoveredZone === 'after'}
					ondragover={(e) => controller.handleFloatingZoneDragOver('after', e)}
					ondragleave={() => controller.handleFloatingZoneDragLeave()}
					ondrop={(e) => controller.handleFloatingZoneDrop('after', e)}
				>↓ After</div>
			{/if}
			{#if controller.isFloatingPositionAllowed('child')}
				<div class="stv__drop-zone stv__drop-zone--child"
					class:stv__drop-zone--active={controller.floatingHoveredZone === 'child'}
					ondragover={(e) => controller.handleFloatingZoneDragOver('child', e)}
					ondragleave={() => controller.handleFloatingZoneDragLeave()}
					ondrop={(e) => controller.handleFloatingZoneDrop('child', e)}
				>→ Child</div>
			{/if}
		</div>
	{/if}

	<!-- Context Menu -->
	{#if controller.contextMenuVisible && controller.contextMenuNode}
		<div bind:this={contextMenuEl} class="stv__context-menu" role="menu">
			{#if getContextMenuItemsCallback}
				{@const menuEntries = getContextMenuItemsCallback(controller.contextMenuNode, controller.closeContextMenu.bind(controller), controller.getSelectedNodes())}
				<ContextMenuLevel
					entries={menuEntries}
					contextNode={controller.contextMenuNode}
					closeContextMenu={controller.closeContextMenu.bind(controller)}
				/>
			{:else if contextMenu}
				{@render contextMenu(controller.contextMenuNode, controller.closeContextMenu.bind(controller))}
			{/if}
		</div>
	{/if}
</div>
