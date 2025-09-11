<script lang="ts" generics="T">
	import {type LTreeNode} from "../ltree/ltree-node.svelte.js"
	import Node from "./Node.svelte"
	import {getContext, type Snippet} from "svelte"
	import type {Ltree} from "../ltree/types.js"

	// Define component props interface
	interface Props {
		node: LTreeNode<T>;
		children?: Snippet<[T]>; // Keep the general children slot for backward compatibility
		onNodeClicked?: (node: LTreeNode<T>) => void;
		onNodeRightClicked?: (node: LTreeNode<T>, event: MouseEvent) => void;
		onNodeDragStart?: (node: LTreeNode<T>, event: DragEvent) => void;
		onNodeDragOver?: (node: LTreeNode<T>, event: DragEvent) => void;
		onNodeDrop?: (node: LTreeNode<T>, event: DragEvent) => void;

		// BEHAVIOUR
		shouldToggleOnNodeClick?: boolean | null | undefined;

		// VISUALS
		expandIconClass?: string | null | undefined;
		collapseIconClass?: string | null | undefined;
		leafIconClass?: string | null | undefined;
		selectedNodeClass?: string | null | undefined;
		dragOverNodeClass?: string | null | undefined;
		isDraggedNode?: boolean | null | undefined;
	}

	// Destructure props using Svelte 5 syntax
	let {
		node,
		children = undefined,
		onNodeClicked,
		onNodeRightClicked,
		onNodeDragStart,
		onNodeDragOver,
		onNodeDrop,

		// BEHAVIOUR
		shouldToggleOnNodeClick = true,

		// VISUALS
		expandIconClass = "ltree-icon-expand",
		collapseIconClass = "ltree-icon-collapse",
		leafIconClass = "ltree-icon-leaf",
		selectedNodeClass,
		dragOverNodeClass,
		isDraggedNode = false,
	}: Props = $props()

	const trie = getContext<Ltree<T>>("Ltree")

	// Drag over state
	let isDraggedOver = $state(false);

	// Convert reactive statements to derived values
	const childrenWithData = $derived(Object.values(node?.children || []))
	const hasChildren = $derived(node?.hasChildren || false)
	const indentStyle = $derived(
		`margin-left: var(--tree-node-indent-per-level, 0.5rem)`,
	)

	function toggleExpanded() {
		if (node.hasChildren) {
			node.isExpanded = !node.isExpanded
			trie.refresh()
		}
	}

	function _onNodeClicked() {
		onNodeClicked?.(node)
		if (shouldToggleOnNodeClick) {
			toggleExpanded()
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="ltree-node"
	id="{node.treeId}-{node.id}"
	data-tree-path="{node.path}"
	style={indentStyle}
>
	<div class="ltree-node-row">
		<!-- Toggle icon with its own click handler -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		{#if hasChildren}
			<span
				class="ltree-toggle-icon ltree-clickable {node.isExpanded
					? collapseIconClass
					: expandIconClass}"
				class:expanded={node.isExpanded}
				onclick={toggleExpanded}
			></span>
		{:else}
			<span class="ltree-toggle-icon {leafIconClass}"></span>
		{/if}

		<!-- Node content with separate click handler -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="ltree-node-content {node.isSelected ? selectedNodeClass : ''} {isDraggedOver && dragOverNodeClass ? dragOverNodeClass : ''}"
			class:ltree-clickable={node.isSelectable}
			class:ltree-dragged={isDraggedNode}
			class:ltree-draggable={node?.isDraggable}
			draggable={node?.isDraggable}
			onclick={(e) => {
				e.stopPropagation();
				_onNodeClicked();
			}}
			oncontextmenu={(e) => {
				e.stopPropagation();
				onNodeRightClicked?.(node, e);
			}}
			ondragstart={(e) => {
				if (node?.isDraggable && e.dataTransfer) {
					// e.stopPropagation();
					e.dataTransfer.effectAllowed = "move";
					e.dataTransfer.setData(
						"application/svelte-treeview",
						JSON.stringify(node),
					);
					console.log(
						"dataTransfer types",
						JSON.stringify(e.dataTransfer.types),
					);
					onNodeDragStart?.(node, e);
				}
			}}
			ondragover={(e) => {
				if (e.dataTransfer?.types.includes("application/svelte-treeview")) {
					e.preventDefault();
					isDraggedOver = true;
				}
				onNodeDragOver?.(node, e);
			}}
			ondragleave={(e) => {
				// Only reset if we're actually leaving the node (not entering a child)
				const rect = e.currentTarget.getBoundingClientRect();
				const x = e.clientX;
				const y = e.clientY;

				if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
					isDraggedOver = false;
				}
			}}
			ondrop={(e) => {
				e.stopPropagation();
				isDraggedOver = false;
				onNodeDrop?.(node, e);
			}}
		>
			{#if children}
				{@render children(node)}
			{:else}
				{trie.getNodeDisplayValue(node)}
			{/if}
		</div>
	</div>

	{#if node?.isExpanded && node?.hasChildren}
		<div class="ltree-children">
			{#each Object.values(node?.children) as item (item.id)}
				<Node
					node={item}
					{children}
					{shouldToggleOnNodeClick}
					{onNodeClicked}
					{onNodeRightClicked}
					{onNodeDragStart}
					{onNodeDragOver}
					{onNodeDrop}
					{expandIconClass}
					{collapseIconClass}
					{leafIconClass}
					{selectedNodeClass}
					{dragOverNodeClass}
					{isDraggedNode}
				/>
			{/each}
		</div>
	{/if}
</div>
