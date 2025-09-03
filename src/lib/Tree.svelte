<script lang="ts" generics="T">
	import type { Index } from "flexsearch";
	import Node from "./Node.svelte";
	import { type LTreeTrieNode } from "./ltree/ltree-trie-node.svelte";
	import { createLTreeTrie } from "./ltree/ltree-trie.svelte";
	import { type LTreeTrie } from "./ltree/types.js";
	import { setContext, tick, type Snippet } from "svelte";

	// Context menu state
	let contextMenuVisible = $state(false);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);
	let contextMenuNode: LTreeTrieNode<T> | null = $state(null);

	// Drag and drop state
	let draggedNode: LTreeTrieNode<any> | null = $state.raw(null);

	interface Props {
		trieId?: string | null | undefined;

		// MAPPINGS
		idMember: string;
		pathMember: string;
		parentPathMember?: string | null | undefined;
		levelMember?: string | null | undefined;
		isExpandedMember?: string | null | undefined;
		isSelectedMember?: string | null | undefined;
		hasChildrenMember?: string | null | undefined;
		isSorted?: boolean | null | undefined;

		displayValueMember?: string | null | undefined;
		getDisplayValueCallback?: (node: LTreeTrieNode<T>) => string;

		searchValueMember?: string | null | undefined;
		getSearchValueCallback?: (node: LTreeTrieNode<T>) => string;

		treeId?: string | null | undefined;
		sortCallback: (items: T[]) => T[];

		// DATA
		data: T[];
		selectedNode?: LTreeTrieNode<T>;

		// SLOTS
		nodeTemplate?: any;
		treeHeader?: any;
		treeBody?: any;
		treeFooter?: any;
		noDataFound?: any;
		contextMenu?: any;

		// BEHAVIOUR
		shouldToggleOnNodeClick?: boolean | null | undefined;
		shouldUseInternalSearchIndex?: boolean | null | undefined;
		initializeIndexCallback?: () => Index;
		searchText?: string | null | undefined;

		// EVENTS
		onNodeClicked?: (node: LTreeTrieNode<T>) => void;
		onNodeDragStart?: (node: LTreeTrieNode<T>, event: DragEvent) => void;
		onNodeDragOver?: (node: LTreeTrieNode<T>, event: DragEvent) => void;
		onNodeDrop?: (
			node: LTreeTrieNode<T>,
			draggedNode: LTreeTrieNode<T>,
			event: DragEvent,
		) => void;

		// VISUALS
		bodyClass?: string | null | undefined;
		selectedNodeClass?: string | null | undefined;
		expandIconClass?: string | null | undefined;
		collapseIconClass?: string | null | undefined;
		leafIconClass?: string | null | undefined;
	}

	let {
		treeId = generateTreeId(),

		// MAPPINGS
		idMember,
		pathMember,
		parentPathMember,
		levelMember,
		hasChildrenMember,

		isExpandedMember,
		isSelectedMember,

		displayValueMember,
		getDisplayValueCallback,
		searchValueMember,
		getSearchValueCallback,
		isSorted,
		sortCallback,

		// DATA
		data,
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

		// EVENTS
		onNodeClicked,
		onNodeDragStart,
		onNodeDragOver,
		onNodeDrop,

		// VISUALS
		bodyClass,
		expandIconClass = "ltree-icon-expand",
		collapseIconClass = "ltree-icon-collapse",
		leafIconClass = "ltree-icon-leaf",
		selectedNodeClass,
	}: Props = $props();

	export async function expandNodes(nodePath: string) {
		console.log("🚀 ~ expandNodes ~ nodePath:", nodePath);
		trie.expandNodes(nodePath);

		// trie.dummyText = Date.now().toLocaleString();
		// console.log(trie.dummyText);
		// rootNodes.forEach((element) => {
		//   if (element.path === nodePath) {
		//     element.isExpanded = !element.isExpanded;
		//     console.log(element)
		//   }
		// });
	}

	export function expandAll(nodePath?: string | null | undefined) {
		trie?.expandAll(nodePath);
	}

	export function collapseAll(nodePath?: string | null | undefined) {
		trie?.collapseAll(nodePath);
	}

	// svelte-ignore non_reactive_update
	// let trie: LTreeTrie<T> | null = null
	// svelte-ignore non_reactive_update
	const trie: LTreeTrie<T> = createLTreeTrie<T>(
		idMember,
		pathMember,
		parentPathMember,
		levelMember,
		hasChildrenMember,

		isExpandedMember,
		isSelectedMember,

		displayValueMember,
		getDisplayValueCallback,
		searchValueMember,
		getSearchValueCallback,
		treeId,

		shouldUseInternalSearchIndex,
		initializeIndexCallback,
		{
			isSorted,
			sortCallback,
		},
	);

	setContext("TreeTrie", trie);

	$effect(() => {
		trie.filterNodes(searchText);
	});

	$effect(() => {
		trie?.insertArray(data);
	});

	$inspect("draggedNode", draggedNode);

	// $inspect("trie change tracker", trie?.changeTracker?.toString());

	function generateTreeId(): string {
		return `${Date.now()}${Math.floor(Math.random() * 10000)}`;
	}

	async function _onNodeClicked(node: LTreeTrieNode<T>) {
		// Close context menu when clicking on any node
		if (contextMenuVisible) {
			closeContextMenu();
		}

		if (selectedNode) {
			const previousNode = trie.getNodeByPath(selectedNode.path);
			previousNode.isSelected = false;
		}

		node.isSelected = true;
		selectedNode = node;

		onNodeClicked?.(node);

		if (!node.hasChildren) trie.refresh();
	}

	function _onNodeRightClicked(node: LTreeTrieNode<T>, event: MouseEvent) {
		if (!contextMenu) return;

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

	function _onNodeDragStart(node: LTreeTrieNode<T>, event: DragEvent) {
		draggedNode = node;
		onNodeDragStart?.(node, event);

		// Set drag effect and data
		// if (event.dataTransfer) {
		// 	event.dataTransfer.effectAllowed = "move";
		// 	event.dataTransfer.setData("text/plain", node.path);
		// }

		console.log("🚀 ~ _onNodeDragStart ~ draggedNode:", draggedNode, event);
	}

	function _onNodeDragOver(node: LTreeTrieNode<T>, event: DragEvent) {
		if (node.treeId !== treeId) {
			console.warn("Updating draggedNode to node from a different tree");
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
				event.dataTransfer.dropEffect = "move";
			}
		}
	}

	function _onNodeDrop(node: LTreeTrieNode<T>, event: DragEvent) {
		console.log(
			"🚀 ~ _onNodeDrop ~ _onNodeDrop:",
			_onNodeDrop,
			event.dataTransfer?.getData("application/svelte-treeview"),
		);
		event.preventDefault();

		if (!draggedNode)
			draggedNode = JSON.parse(
				event.dataTransfer?.getData("application/svelte-treeview"),
			);

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
			if (!target.closest(".ltree-context-menu")) {
				closeContextMenu();
			}
		}
	}

	// Add global event listener for document clicks
	$effect(() => {
		if (contextMenuVisible) {
			const handleGlobalClick = (event: MouseEvent) => {
				const target = event.target as Element;
				if (!target.closest(".ltree-context-menu")) {
					closeContextMenu();
				}
			};

			document.addEventListener("click", handleGlobalClick);
			document.addEventListener("contextmenu", handleGlobalClick);

			return () => {
				document.removeEventListener("click", handleGlobalClick);
				document.removeEventListener("contextmenu", handleGlobalClick);
			};
		}
	});
</script>

<div>
	{#if treeHeader}
		{@render treeHeader()}
	{/if}
	Tree id: {treeId}
	Dragging node: {draggedNode?.path || "none"}
	<div class:bodyClass>
		{#if trie?.root}
			{#key trie.changeTracker}
				<div class="ltree-tree">
					{#each trie.tree as node (node.id)}
						<Node
							{node}
							children={nodeTemplate}
							{shouldToggleOnNodeClick}
							onNodeClicked={(node) => _onNodeClicked(node)}
							onNodeRightClicked={(node, event) =>
								_onNodeRightClicked(node, event)}
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
							{@render noDataFound()}
						</div>
					{/each}
				</div>
			{/key}
		{:else}
			<div class="ltree-empty-state">
				{@render noDataFound()}
			</div>
		{/if}
	</div>
	{#if treeFooter}
		{@render treeFooter()}
	{/if}

	<!-- Context Menu -->
	{#if contextMenuVisible && contextMenu && contextMenuNode}
		<div
			class="ltree-context-menu"
			style="left: {contextMenuX}px; top: {contextMenuY}px;"
		>
			{@render contextMenu(contextMenuNode, closeContextMenu)}
		</div>
	{/if}
</div>
