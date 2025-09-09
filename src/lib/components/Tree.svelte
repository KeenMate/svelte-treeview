<script lang="ts" generics="T">
	import type { Index } from 'flexsearch';
	import Node from './Node.svelte';
	import { type LTreeNode } from '../ltree/ltree-node.svelte.js';
	import { createLTree } from '../ltree/ltree.svelte.js';
	import { type Ltree, type InsertArrayResult } from '../ltree/types.js';
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

		// EVENTS
		onNodeClicked?: (node: LTreeNode<T>) => void;
		onNodeDragStart?: (node: LTreeNode<T>, event: DragEvent) => void;
		onNodeDragOver?: (node: LTreeNode<T>, event: DragEvent) => void;
		onNodeDrop?: (node: LTreeNode<T>, draggedNode: LTreeNode<T>, event: DragEvent) => void;

		// VISUALS
		bodyClass?: string | null | undefined;
		selectedNodeClass?: string | null | undefined;
		dragOverNodeClass?: string | null | undefined;
		expandIconClass?: string | null | undefined;
		collapseIconClass?: string | null | undefined;
		leafIconClass?: string | null | undefined;
		scrollHighlightTimeout?: number | null | undefined;
		scrollHighlightClass?: string | null | undefined;
	}

	let {
		treeId,
		treePathSeparator,

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
		nodeTemplate,
		treeHeader,
		treeFooter,
		noDataFound,
		contextMenu,

		// BEHAVIOUR
		expandLevel = 2,

		shouldToggleOnNodeClick = true,
		shouldUseInternalSearchIndex = true,
		initializeIndexCallback,
		searchText = $bindable(),
		indexerBatchSize = 25,
		indexerTimeout = 50,
		shouldDisplayDebugInformation = false,

		// EVENTS
		onNodeClicked,
		onNodeDragStart,
		onNodeDragOver,
		onNodeDrop,

		// VISUALS
		bodyClass,
		expandIconClass = 'ltree-icon-expand',
		collapseIconClass = 'ltree-icon-collapse',
		leafIconClass = 'ltree-icon-leaf',
		selectedNodeClass,
		dragOverNodeClass,
		scrollHighlightTimeout = 4000,
		scrollHighlightClass = 'ltree-scroll-highlight'
	}: Props = $props();

	export async function expandNodes(nodePath: string) {
		tree.expandNodes(nodePath);

		// trie.dummyText = Date.now().toLocaleString();
		// console.log(trie.dummyText);
		// rootNodes.forEach((element) => {
		//   if (element.path === nodePath) {
		//     element.isExpanded = !element.isExpanded;
		//     console.log(element)
		//   }
		// });
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

	export function searchNodes(searchText: string | null | undefined): LTreeNode<T>[] {
		return tree?.searchNodes(searchText) || [];
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
			console.log(
				'🚀 elementId ~ scrollToPath ~ adding scrollHighlightClass:',
				elementId,
				scrollHighlightClass
			);
			setTimeout(() => {
				console.log(
					'🚀 elementId ~ scrollToPath ~ removing scrollHighlightClass:',
					elementId,
					scrollHighlightClass
				);
				contentDiv.classList.remove(scrollHighlightClass);
			}, scrollHighlightTimeout);
		}

		return true;
	}

	treeId = treeId || generateTreeId();

	// svelte-ignore non_reactive_update
	// let trie: Ltree<T> | null = null
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
				console.log('🚀 ~ _onNodeClicked ~ previousNode:', previousNode);
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
		if (!contextMenu) {
			return;
		}

		event.preventDefault();
		contextMenuNode = node;
		contextMenuX = event.clientX;
		contextMenuY = event.clientY;
		contextMenuVisible = true;
	}

	function closeContextMenu() {
		contextMenuVisible = false;
		contextMenuNode = null;
	}

	function _onNodeDragStart(node: LTreeNode<T>, event: DragEvent) {
		draggedNode = node;
		onNodeDragStart?.(node, event);

		// Set drag effect and data
		// if (event.dataTransfer) {
		// 	event.dataTransfer.effectAllowed = "move";
		// 	event.dataTransfer.setData("text/plain", node.path);
		// }

		console.log('🚀 ~ _onNodeDragStart ~ draggedNode:', draggedNode, event);
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

	// Add global event listener for document clicks
	$effect.root(() => {
		if (contextMenuVisible) {
			const handleGlobalClick = (event: MouseEvent) => {
				const target = event.target as Element;
				if (!target.closest('.ltree-context-menu')) {
					closeContextMenu();
				}
			};

			document.addEventListener('click', handleGlobalClick);
			document.addEventListener('contextmenu', handleGlobalClick);

			return () => {
				document.removeEventListener('click', handleGlobalClick);
				document.removeEventListener('contextmenu', handleGlobalClick);
			};
		}
	});
</script>

<div>
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

	{#if treeHeader}
		{@render treeHeader?.()}
	{/if}
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
	{#if treeFooter}
		{@render treeFooter?.()}
	{/if}

	<!-- Context Menu -->
	{#if contextMenuVisible && contextMenu && contextMenuNode}
		<div class="ltree-context-menu" style="left: {contextMenuX}px; top: {contextMenuY}px;">
			{@render contextMenu(contextMenuNode, closeContextMenu)}
		</div>
	{/if}
</div>
