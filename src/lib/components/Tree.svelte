<script lang="ts" generics="T">
	import type { Index } from 'flexsearch';
	import Node from './Node.svelte';
	import { type LTreeNode } from '../ltree/ltree-node.svelte.js';
	import { createLTree } from '../ltree/ltree.svelte.js';
	import { type Ltree } from '../ltree/types.js';
	import { setContext } from 'svelte';

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
		sortCallback?: (items: LTreeNode<T>[]) => LTreeNode<T>[];

		// DATA
		data: T[];
		selectedNode?: LTreeNode<T>;

		// SLOTS
		nodeTemplate?: any;
		treeHeader?: any;
		treeBody?: any;
		treeFooter?: any;
		noDataFound?: any;
		contextMenu?: any;

		// BEHAVIOUR
		shouldToggleOnNodeClick?: boolean | null | undefined;
		initializeIndexCallback?: () => Index;
		searchText?: string | null | undefined;
		shouldUseInternalSearchIndex?: boolean | null | undefined;
		shouldDisplayDebugInformation?: boolean;

		// EVENTS
		onNodeClicked?: (node: LTreeNode<T>) => void;
		onNodeDragStart?: (node: LTreeNode<T>, event: DragEvent) => void;
		onNodeDragOver?: (node: LTreeNode<T>, event: DragEvent) => void;
		onNodeDrop?: (node: LTreeNode<T>, draggedNode: LTreeNode<T>, event: DragEvent) => void;

		// VISUALS
		bodyClass?: string | null | undefined;
		selectedNodeClass?: string | null | undefined;
		expandIconClass?: string | null | undefined;
		collapseIconClass?: string | null | undefined;
		leafIconClass?: string | null | undefined;
	}

	let {
		treeId,

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

		// SLOTS
		nodeTemplate,
		treeHeader,
		treeFooter,
		noDataFound,
		contextMenu,

		// BEHAVIOUR
		shouldToggleOnNodeClick = true,
		shouldUseInternalSearchIndex,
		initializeIndexCallback,
		searchText = $bindable(),
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
		selectedNodeClass
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

		shouldUseInternalSearchIndex,
		initializeIndexCallback,
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
		tree?.insertArray(data);
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
			previousNode.isSelected = false;
		}

		node.isSelected = true;
		selectedNode = node;

		onNodeClicked?.(node);

		if (!node.hasChildren) {
			tree.refresh();
		}
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
	{#if treeHeader}
		{@render treeHeader?.()}
	{/if}
	{#if shouldDisplayDebugInformation}
		<div class="ltree-debug-info">
			<details>
				<summary>Debug Info</summary>
				<div class="ltree-debug-stats">
					<span>Tree: {treeId}</span>
					<span>Data: {data?.length || 0}</span>
					<span>Nodes: {tree?.statistics.nodeCount || 0}</span>
					<span>Levels: {tree?.statistics.maxLevel || 0}</span>
					<span>Dragging: {draggedNode?.path || 'none'}</span>
				</div>
			</details>
		</div>
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
