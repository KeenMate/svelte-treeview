<script lang="ts" generics="T">
	import type { Index, SearchOptions } from 'flexsearch';
	import Node from './Node.svelte';
	import { type LTreeNode } from '../ltree/ltree-node.svelte.js';
	import {
		type InsertArrayResult,
		type ContextMenuItem,
		type DropPosition,
		type DragDropMode,
		type DropOperation,
		type TreeChange,
		type ApplyChangesResult
	} from '../ltree/types.js';
	import { setContext, onDestroy } from 'svelte';
	import type { RenderStats } from './RenderCoordinator.svelte.js';
	import { TreeController } from '../core/TreeController.svelte.js';
	import { createTreeController } from '../core/createTreeController.js';

	// NodeCallbacks and NodeConfig are now defined in ../core/TreeController.svelte.ts
	// and re-exported from index.ts for public consumption.

	interface Props {
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

		// For sibling ordering in drag-drop (before/after positioning)
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
		/** Indentation per level in flat rendering mode (CSS value, default: '1.5rem') */
		flatIndentSize?: string;

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
		flatIndentSize = '1.5rem',

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

	// ── Create controller ───────────────────────────────────────────────
	const controller = createTreeController<T>({
		idMember,
		pathMember,
		parentPathMember,
		levelMember,
		hasChildrenMember,
		isExpandedMember,
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
		selectedNode,
		expandLevel,
		shouldToggleOnNodeClick,
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
		flatIndentSize,
		dragDropMode,
		dropZoneMode,
		dropZoneLayout,
		dropZoneStart,
		dropZoneMaxWidth,
		allowCopy,
		autoHandleCopy,
		onNodeClicked,
		onNodeDragStart,
		onNodeDragOver,
		beforeDropCallback,
		onNodeDrop,
		contextMenuCallback,
		hasContextMenuSnippet: !!contextMenu,
		bodyClass,
		selectedNodeClass,
		dragOverNodeClass,
		expandIconClass,
		collapseIconClass,
		leafIconClass,
		scrollHighlightTimeout,
		scrollHighlightClass,
		contextMenuXOffset,
		contextMenuYOffset,
	});

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
	$effect(() => { controller.treePathSeparator = treePathSeparator ?? '.'; });
	$effect(() => { controller.shouldDisplayDebugInformation = shouldDisplayDebugInformation ?? false; });
	$effect(() => { controller.shouldDisplayContextMenuInDebugMode = shouldDisplayContextMenuInDebugMode ?? false; });
	$effect(() => { controller.isLoading = isLoading ?? false; });
	$effect(() => { controller.bodyClass = bodyClass; });
	$effect(() => { controller.useFlatRendering = useFlatRendering ?? true; });
	$effect(() => { controller.flatIndentSize = flatIndentSize ?? '1.5rem'; });
	$effect(() => { controller.progressiveRender = progressiveRender ?? true; });
	$effect(() => { controller.initialBatchSize = initialBatchSize ?? 20; });
	$effect(() => { controller.maxBatchSize = maxBatchSize ?? 500; });
	$effect(() => { controller.dragDropMode = dragDropMode ?? 'none'; });
	$effect(() => { controller.allowCopy = allowCopy ?? false; });
	$effect(() => { controller.autoHandleCopy = autoHandleCopy ?? true; });
	$effect(() => { controller.hasContextMenuSnippet = !!contextMenu; });

	// Visual config sync (drives nodeConfig update via controller's internal effect)
	$effect(() => { controller.shouldToggleOnNodeClick = shouldToggleOnNodeClick ?? true; });
	$effect(() => { controller.expandIconClass = expandIconClass ?? 'ltree-icon-expand'; });
	$effect(() => { controller.collapseIconClass = collapseIconClass ?? 'ltree-icon-collapse'; });
	$effect(() => { controller.leafIconClass = leafIconClass ?? 'ltree-icon-leaf'; });
	$effect(() => { controller.selectedNodeClass = selectedNodeClass; });
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
	$effect(() => { controller.onNodeClickedCb = onNodeClicked; });
	$effect(() => { controller.onNodeDragStartCb = onNodeDragStart; });
	$effect(() => { controller.onNodeDragOverCb = onNodeDragOver; });
	$effect(() => { controller.beforeDropCallbackCb = beforeDropCallback; });
	$effect(() => { controller.onNodeDropCb = onNodeDrop; });
	$effect(() => { controller.contextMenuCallbackCb = contextMenuCallback; });
	$effect(() => { controller.onRenderStartCb = onRenderStart; });
	$effect(() => { controller.onRenderProgressCb = onRenderProgress; });
	$effect(() => { controller.onRenderCompleteCb = onRenderComplete; });

	// ── Sync controller → bindable props (outputs flow back to parent) ──
	$effect(() => { selectedNode = controller.selectedNode; });
	$effect(() => { insertResult = controller.insertResult; });
	$effect(() => { isRendering = controller.isRendering; });

	// Bidirectional: parent can also SET selectedNode
	$effect(() => { controller.selectedNode = selectedNode; });

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
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="ltree-container"
	bind:this={treeContainerRef}
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
			<!-- Flat rendering mode: no {#key} block, uses visibleFlatNodes for efficient updates -->
			{#if controller.useFlatRendering}
				<div class="ltree-tree ltree-flat-mode">
					{#each controller.flatNodesToRender as node (node.id + '|' + node.path + '|' + node.hasChildren + '|' + node._rev)}
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
							flatIndentSize={controller.flatIndentSize}
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

	<!-- Context Menu -->
	{#if controller.contextMenuVisible && controller.contextMenuNode}
		<div class="ltree-context-menu" style="left: {controller.contextMenuX}px; top: {controller.contextMenuY}px;">
			{#if contextMenuCallback}
				{@const menuItems = contextMenuCallback(controller.contextMenuNode, controller.closeContextMenu.bind(controller))}
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
				{@render contextMenu(controller.contextMenuNode, controller.closeContextMenu.bind(controller))}
			{/if}
		</div>
	{/if}
</div>
