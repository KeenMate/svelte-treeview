<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Checkbox from './Checkbox.svelte';
	import { SelectionModes, InsertionType, type Node, type Tree } from '$lib/types.js';
	import type { CustomizableClasses, TreeHelper } from '$lib/index.js';

	const dispatch = createEventDispatcher();

	export let tree: Node[];
	export let treeId: string;
	export let recursive = false;
	export let checkboxes: SelectionModes = SelectionModes.none;
	export let onlyLeafCheckboxes: boolean;
	export let hideDisabledCheckboxes: boolean;
	export let dragAndDrop: boolean;
	export let verticalLines: boolean;
	export let readonly: boolean;
	export let expandTo: number;
	export let classes: CustomizableClasses;
	export let helper: TreeHelper;

	export let draggedPath: string | null;
	export let highlightedNode: Node | null;
	export let childDepth: number;
	export let branchRootNode: Node | null;
	export let canNest: boolean;
	export let validTarget: boolean;
	export let insPos: InsertionType;

	const getNodeId = (node: Node) => `${treeId}-${node.path}`;

	function setExpansion(node: Node, changeTo: boolean) {
		dispatch('internal-expand', { node: node, changeTo });
	}

	function isExpanded(node: Node, depth: number, expandToDepth: number) {
		const nodeExpanded = node.expanded;

		//if expanded prop is defined it has priority over expand to
		if (nodeExpanded === null) {
			return depth <= expandToDepth;
		}
		return nodeExpanded;
	}

	//checkboxes
	function selectionChanged(node: Node) {
		dispatch('internal-selectionChanged', { node: node });
	}

	// drag and drop
	function handleDragStart(e: DragEvent, node: Node) {
		dispatch('internal-handleDragStart', { node: node, e: e });
	}

	function handleDragDrop(e: DragEvent, node: Node, el: HTMLElement) {
		dispatch('internal-handleDragStart', { node: node, event: e, element: el });
	}

	function handleDragOver(e: DragEvent, node: Node, el: HTMLElement) {
		dispatch('internal-handleDragOver', { node: node, event: e, element: el });
	}

	function handleDragEnter(e: DragEvent, node: Node, el: HTMLElement) {
		dispatch('internal-handleDragEnter', { node: node, event: e, element: el });
	}

	function handleDragEnd(e: DragEvent, node: Node) {
		dispatch('internal-handleDragEnd', { node: node, event: e });
	}

	function handleDragLeave(e: DragEvent, node: Node, el: HTMLElement) {
		dispatch('internal-handleDragLeave', { node: node, event: e, element: el });
	}

	/**
	 *check if this node is one being hovered over (highlited) and is valid target
	 */
	function highlighThisNode(node: Node, highlitedNode: Node, validTarget: boolean) {
		return validTarget && highlitedNode.path == node.path;
	}
	/**
	 * returns true, it should highlight nesting on this node
	 * @param node node
	 * @param highlitedNode highlited node
	 * @param validTarget valid target
	 * @param canNest can nest
	 */
	function highlightNesting(
		node: Node,
		highlitedNode: Node | null,
		validTarget: boolean,
		canNest: boolean
	) {
		if (!highlitedNode) return false;

		return (
			canNest && highlighThisNode(node, highlitedNode, validTarget) && node.nestDisabled !== true
		);
	}
	/**
	 * returns true, it should highlight nesting on this node
	 * @param node node
	 * @param highlitedNode highlited node
	 * @param validTarget valid target
	 * @param canNest can nest
	 */
	function highlightInsert(
		node: Node,
		highlitedNode: Node | null,
		validTarget: boolean,
		canNest: boolean
	) {
		if (!highlitedNode) return false;

		return (
			!canNest && highlighThisNode(node, highlitedNode, validTarget) && node.nestDisabled !== true
		);
	}

	let liElements: { [key: string]: HTMLLIElement } = {};
</script>

<ul
	class:show-lines={childDepth === 0 && verticalLines}
	class:child-menu={childDepth > 0}
	class={childDepth === 0 ? classes.treeClass : ''}
>
	{#each helper.getDirectChildren(tree, branchRootNode?.path ?? null) as node (getNodeId(node))}
		{@const nesthighlighed = highlightNesting(node, highlightedNode, validTarget, canNest)}
		{@const insertHighlighted = highlightInsert(node, highlightedNode, validTarget, canNest)}
		{@const expanded = isExpanded(node, childDepth, expandTo)}
		{@const hasChildren = node.hasChildren}
		{@const draggable = !readonly && dragAndDrop && node.isDraggable}
		{@const isCurrentlyDragged =
			draggedPath == node.path || (draggedPath && node.path?.startsWith(draggedPath))}

		<li
			class:is-child={helper.nodePathIsChild(node.path)}
			class:has-children={hasChildren}
			on:contextmenu|stopPropagation={(e) => {
				dispatch('open-ctxmenu', { e: e, node: Node });
			}}
			on:drop|stopPropagation={(e) => handleDragDrop(e, node, liElements[getNodeId(node)])}
			on:dragover|stopPropagation={(e) => handleDragOver(e, node, liElements[getNodeId(node)])}
			on:dragenter|stopPropagation={(e) => handleDragEnter(e, node, liElements[getNodeId(node)])}
			on:dragleave|stopPropagation={(e) => handleDragLeave(e, node, liElements[getNodeId(node)])}
			bind:this={liElements[getNodeId(node)]}
		>
			{#if insPos == InsertionType.above && insertHighlighted}
				<div class="insert-line-wrapper">
					<div class="insert-line {classes.inserLineClass}" />
				</div>
			{/if}

			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="tree-item
				{nesthighlighed ? classes.expandClass : ''}
				{classes.nodeClass} {isCurrentlyDragged ? classes.currentlyDraggedClass : ''}"
				class:div-has-children={hasChildren}
				class:hover={insertHighlighted || nesthighlighed}
				{draggable}
				on:dragstart={(e) => handleDragStart(e, node)}
				on:dragend={(e) => handleDragEnd(e, node)}
			>
				{#if hasChildren}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<span on:click={() => setExpansion(node, !expanded)}>
						<!-- use callback overrides expanded  -->
						<i
							class="far {expanded ? classes.expandedToggleClass : classes.collapsedToggleClass}"
							class:fa-minus-square={expanded}
							class:fa-plus-square={!expanded || node.useCallback}
						/>
					</span>
				{:else}
					<span />
				{/if}

				<Checkbox
					{checkboxes}
					{helper}
					{recursive}
					{node}
					{onlyLeafCheckboxes}
					{hideDisabledCheckboxes}
					{readonly}
					on:select={({ detail: { node } }) => selectionChanged(node)}
				/>
				<span class:pointer-cursor={draggable}>
					<slot node={node.originalNode} />
				</span>
			</div>

			{#if nesthighlighed}
				<div class="insert-line-wrapper">
					<div
						class="insert-line insert-line-child {classes.inserLineClass} {classes.inserLineNestClass}"
					/>
				</div>
			{/if}
			{#if expanded && hasChildren}
				<svelte:self
					branchRootNode={node}
					childDepth={childDepth + 1}
					{treeId}
					{checkboxes}
					{tree}
					{recursive}
					{helper}
					{classes}
					{readonly}
					{onlyLeafCheckboxes}
					{hideDisabledCheckboxes}
					{expandTo}
					{draggedPath}
					{dragAndDrop}
					{verticalLines}
					{canNest}
					{insPos}
					{validTarget}
					{highlightedNode}
					on:open-ctxmenu
					on:internal-expand
					on:internal-selectionChanged
					let:node={nodeNested}
				>
					<slot node={nodeNested} />
				</svelte:self>
			{/if}
			{#if !expanded && hasChildren}
				<ul class:child-menu={childDepth > 0} />
			{/if}
			<!-- Show line if insering -->
			{#if insPos === InsertionType.below && insertHighlighted}
				<div class="insert-line-wrapper">
					<div class="insert-line {classes.inserLineClass}" />
				</div>
			{/if}
		</li>
	{/each}
</ul>
