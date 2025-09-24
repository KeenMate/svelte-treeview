<script lang="ts" generics="T">
	import type { Index, SearchOptions } from 'flexsearch';
	import Node from './Node.svelte';
	import { type LTreeNode } from '../ltree/ltree-node.svelte.js';
	import { createLTree } from '../ltree/ltree.svelte.js';
	import { type Ltree, type InsertArrayResult, type ContextMenuItem } from '../ltree/types.js';
	import { setContext, tick } from 'svelte';

	// Context menu state
	let contextMenuVisible = $state(false);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);
	let contextMenuNode: LTreeNode<T> | null = $state(null);

	// Drag and drop state
	let draggedNode: LTreeNode<any> | null = $state.raw(null);

	interface Props {
		trieId?: string | null | undefined;

		// MAPPINGS
		idMember: string;
		pathMember: string;
		parentPathMember?: string | null | undefined;
		levelMember?: string | null | undefined;
		isExpandedMember?: string | null | undefined;
		isSelectedMember?: string | null | undefined;
		isDraggableMember?: string | null | undefined;
		isDropAllowedMember?: string | null | undefined;
		hasChildrenMember?: string | null | undefined;
		isSorted?: boolean | null | undefined;

		displayValueMember?: string | null | undefined;
		getDisplayValueCallback?: (node: LTreeNode<T>) => string;

		searchValueMember?: string | null | undefined;
		getSearchValueCallback?: (node: LTreeNode<T>) => string;

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

		// EVENTS
		onNodeClicked?: (node: LTreeNode<T>) => void;
		onNodeDragStart?: (node: LTreeNode<T>, event: DragEvent) => void;
		onNodeDragOver?: (node: LTreeNode<T>, event: DragEvent) => void;
		onNodeDrop?: (node: LTreeNode<T>, draggedNode: LTreeNode<T>, event: DragEvent) => void;
		contextMenuCallback?: (node: LTreeNode<T>) => ContextMenuItem[];

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

		displayValueMember,
		getDisplayValueCallback,
		searchValueMember,
		getSearchValueCallback,
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

		// EVENTS
		onNodeClicked,
		onNodeDragStart,
		onNodeDragOver,
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

	export async function scrollToPath(
		path: string,
		options?: { expand?: boolean; highlight?: boolean; scrollOptions?: ScrollIntoViewOptions }
	): Promise<boolean> {
		const {
			expand = true,
			highlight = true,
			scrollOptions = { behavior: 'smooth', block: 'center' }
		} = options || {};

		// First, find the node to get its ID
		const node = tree.getNodeByPath(path);
		if (!node || !node.id) {
			console.warn(`[Tree ${treeId}] Node not found for path: ${path}`);
			return false;
		}

		// Expand the path if requested
		if (expand) {
			tree.expandNodes(path);
			tree.refresh();
			await tick();
			// Wait for DOM update
			// await new Promise((resolve) => setTimeout(resolve, 100));
		}

		// Find the DOM element using the generated ID
		const elementId = `${treeId}-${node.id}`;
		const element = document.getElementById(elementId);
		const contentDiv = element.querySelector('.ltree-node-content');

		if (!contentDiv) {
			console.warn(`[Tree ${treeId}] DOM element not found for node ID: ${elementId}`);
			return false;
		}

		// Scroll to the element
		contentDiv.scrollIntoView(scrollOptions);

		// Highlight the node temporarily if requested
		if (highlight && scrollHighlightClass) {
			contentDiv.classList.add(scrollHighlightClass);
			setTimeout(() => {
				contentDiv.classList.remove(scrollHighlightClass);
			}, scrollHighlightTimeout);
		}

		return true;
	}

	treeId = treeId || generateTreeId();

	if (shouldDisplayDebugInformation)
		console.log("Tree treePathSeparator:", treePathSeparator)

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

		displayValueMember,
		getDisplayValueCallback,
		searchValueMember,
		getSearchValueCallback,
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

	$effect(() => {
		tree.filterNodes(searchText);
	});

	$effect(() => {
		if (tree && data) {
			insertResult = tree.insertArray(data);
		}
	});

	// $inspect("trie change tracker", trie?.changeTracker?.toString());

	function generateTreeId(): string {
		return `${Date.now()}${Math.floor(Math.random() * 10000)}`;
	}

	async function _onNodeClicked(node: LTreeNode<T>) {
		// Close context menu when clicking on any node
		if (contextMenuVisible) {
			closeContextMenu();
		}

		if (selectedNode) {
			const previousNode = tree.getNodeByPath(selectedNode.path);
			if (previousNode) {
				previousNode.isSelected = false;
			} else selectedNode = null;
		}

		node.isSelected = true;
		selectedNode = node;

		onNodeClicked?.(node);

		// if (!node.hasChildren) {
		tree.refresh();
		// }
	}

	function _onNodeRightClicked(node: LTreeNode<T>, event: MouseEvent) {
		if (!contextMenu && !contextMenuCallback) {
			return;
		}

		event.preventDefault();
		contextMenuNode = node;
		contextMenuX = event.clientX + contextMenuXOffset;
		contextMenuY = event.clientY + contextMenuYOffset;
		contextMenuVisible = true;
		isDebugMenuActive = false; // This is a user-triggered menu, not debug menu
	}

	function closeContextMenu() {
		contextMenuVisible = false;
		contextMenuNode = null;
		isDebugMenuActive = false;
	}

	function _onNodeDragStart(node: LTreeNode<T>, event: DragEvent) {
		draggedNode = node;
		onNodeDragStart?.(node, event);

		// Set drag effect and data
		// if (event.dataTransfer) {
		// 	event.dataTransfer.effectAllowed = "move";
		// 	event.dataTransfer.setData("text/plain", node.path);
		// }
	}

	function _onNodeDragOver(node: LTreeNode<T>, event: DragEvent) {
		if (node.treeId !== treeId) {
			console.warn('Updating draggedNode to node from a different tree');
			draggedNode = node;
		} // this is for cases when we drag node from one tree to another

		// 		console.log(
		// 			"🚀 ~ _onNodeDragOver ~ draggedNode:",
		// treeId,
		// 			draggedNode,
		// 			$state.snapshot(draggedNode),
		// 			node,
		// 			event
		// 		);
		if (draggedNode && $state.snapshot(draggedNode) !== node) {
			event.preventDefault();
			onNodeDragOver?.(node, event);

			// Set visual feedback
			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = 'move';
			}
		}
	}

	function _onNodeDrop(node: LTreeNode<T>, event: DragEvent) {
		if (shouldDisplayDebugInformation)
			console.log(
				'🚀 ~ _onNodeDrop ~ _onNodeDrop:',
				_onNodeDrop,
				event.dataTransfer?.getData('application/svelte-treeview')
			);
		event.preventDefault();

		if (!draggedNode) {
			draggedNode = JSON.parse(event.dataTransfer?.getData('application/svelte-treeview'));
		}

		if (draggedNode && draggedNode !== node) {
			onNodeDrop?.(node, draggedNode, event);
		}

		// Reset drag state
		draggedNode = null;
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
				if (shouldDisplayDebugInformation) {
					console.log(`[Tree ${treeId}] Scroll/wheel event detected, closing context menu`, event?.type);
				}
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

				if (shouldDisplayDebugInformation) {
					console.log(`[Tree ${treeId}] Debug context menu displayed for node:`, targetNode.data, `at position (${contextMenuX}, ${contextMenuY})`);
				}
			}
		} else if (!shouldDisplayContextMenuInDebugMode && isDebugMenuActive) {
			// Only hide the context menu if it was opened by debug mode
			contextMenuVisible = false;
			contextMenuNode = null;
			isDebugMenuActive = false;
		}
	});
</script>

<div bind:this={treeContainerRef}>
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
	<div class:bodyClass>
		{#if tree?.root}
			{#key tree.changeTracker}
				<div class="ltree-tree">
					{#each tree.tree as node (node.id)}
						<Node
							{node}
							children={nodeTemplate}
							{shouldToggleOnNodeClick}
							onNodeClicked={(node) => _onNodeClicked(node)}
							onNodeRightClicked={(node, event) => _onNodeRightClicked(node, event)}
							onNodeDragStart={(node, event) => _onNodeDragStart(node, event)}
							onNodeDragOver={(node, event) => _onNodeDragOver(node, event)}
							onNodeDrop={(node, event) => _onNodeDrop(node, event)}
							{expandIconClass}
							{collapseIconClass}
							{leafIconClass}
							{selectedNodeClass}
							{dragOverNodeClass}
							isDraggedNode={draggedNode === node}
						/>
					{:else}
						<div class="ltree-empty-state">
							{@render noDataFound?.()}
						</div>
					{/each}
				</div>
			{/key}
		{:else}
			<div class="ltree-empty-state">
				{@render noDataFound?.()}
			</div>
		{/if}
	</div>

	{@render treeFooter?.()}

	<!-- Context Menu -->
	{#if contextMenuVisible && contextMenuNode}
		<div class="ltree-context-menu" style="left: {contextMenuX}px; top: {contextMenuY}px;">
			{#if contextMenuCallback}
				{@const menuItems = contextMenuCallback(contextMenuNode)}
				{#each menuItems as item}
					{#if item.isDivider}
						<div class="ltree-context-menu-divider"></div>
					{:else}
						<div
							class="ltree-context-menu-item"
							class:ltree-context-menu-item-disabled={item.isDisabled}
							onclick={() => !item.isDisabled && item.callback()}
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
