<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Checkbox from './Checkbox.svelte';
	import {
		SelectionModes,
		InsertionType,
		type Node,
		type Tree,
		type CustomizableClasses
	} from '$lib/types.js';
	import type { TreeHelper } from '$lib/helpers/tree-helper.js';

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
	export let childDepth: number;
	export let branchRootNode: Node | null;

	export let draggedNode: Node | null;
	export let highlightedNode: Node | null;
	export let insertionType: InsertionType;

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
		dispatch('internal-handleDragDrop', { node: node, event: e, element: el });
	}

	function handleDragOver(e: DragEvent, node: Node, el: HTMLElement, nest: boolean) {
		dispatch('internal-handleDragOver', { node: node, event: e, element: el, nest });
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

	function getHighlighMode(
		node: Node,
		highlightedNode: Node | null,
		insertionType: InsertionType
	): InsertionType {
		// return InsertionType.insertAbove;

		if (highlightedNode?.path !== node.path) return InsertionType.none;
		return insertionType;
	}

	// TODO maybe this can be removed?
	let liElements: { [key: string]: HTMLLIElement } = {};
</script>

<ul
	class:show-lines={childDepth === 0 && verticalLines}
	class:child-menu={childDepth > 0}
	class={childDepth === 0 ? classes.treeClass : ''}
>
	{#each helper.getDirectChildren(tree, branchRootNode?.path ?? null) as node (getNodeId(node))}
		{@const expanded = isExpanded(node, childDepth, expandTo)}
		{@const draggable = !readonly && dragAndDrop && !node.dragDisabled}
		{@const isCurrentlyDragged = draggedNode && node.path.startsWith(draggedNode?.path)}
		{@const effectiveHighlight = getHighlighMode(node, highlightedNode, insertionType)}
		<li
			class:is-child={helper.nodePathIsChild(node.path)}
			class:has-children={node.hasChildren}
			on:contextmenu|stopPropagation={(e) => {
				dispatch('open-ctxmenu', { e, node });
			}}
			on:drop|stopPropagation={(e) => handleDragDrop(e, node, liElements[getNodeId(node)])}
			on:dragover|stopPropagation={(e) =>
				handleDragOver(e, node, liElements[getNodeId(node)], false)}
			on:dragenter|stopPropagation={(e) => handleDragEnter(e, node, liElements[getNodeId(node)])}
			on:dragleave|stopPropagation={(e) => handleDragLeave(e, node, liElements[getNodeId(node)])}
			bind:this={liElements[getNodeId(node)]}
		>
			{#if effectiveHighlight == InsertionType.insertAbove}
				<div class="insert-line-wrapper">
					<div class="insert-line {classes.inserLineClass}" />
				</div>
			{/if}

			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="tree-item
				{effectiveHighlight === InsertionType.nest ? classes.expandClass : ''}
				{classes.nodeClass} {isCurrentlyDragged ? classes.currentlyDraggedClass : ''}"
				class:div-has-children={node.hasChildren}
				class:hover={effectiveHighlight !== InsertionType.none}
				{draggable}
				on:dragstart={(e) => handleDragStart(e, node)}
				on:dragend={(e) => handleDragEnd(e, node)}
			>
				{#if node.hasChildren}
					<button
						class="expansion-button"
						on:click={() => setExpansion(node, !expanded)}
						type="button"
					>
						<i class="fa-fw {expanded ? classes.collapseIcon : classes.expandIcon}" />
					</button>
				{:else}
					<span class="fa-fw" />
				{/if}

				<Checkbox
					{checkboxes}
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

				{#if dragAndDrop && node.nestAllowed}
					<span
						on:dragover|stopPropagation={(e) =>
							handleDragOver(e, node, liElements[getNodeId(node)], true)}
					>
						<i class="fa-fw {classes.nestIcon}" />

						{#if effectiveHighlight === InsertionType.nest}
							<slot name="nest-highlight" />
						{/if}
					</span>
				{/if}
			</div>
			{#if expanded && node.hasChildren}
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
					{dragAndDrop}
					{verticalLines}
					{draggedNode}
					{highlightedNode}
					{insertionType}
					on:open-ctxmenu
					on:internal-expand
					on:internal-selectionChanged
					on:internal-handleDragStart
					on:internal-handleDragDrop
					on:internal-handleDragOver
					on:internal-handleDragEnter
					on:internal-handleDragEnd
					on:internal-handleDragLeave
					let:node={nodeNested}
				>
					<slot node={nodeNested} />
					<svelte:fragment slot="nest-highlight">
						<slot name="nest-highlight" />
					</svelte:fragment>
				</svelte:self>
			{/if}
			{#if !expanded && node.hasChildren}
				<ul class:child-menu={childDepth > 0} />
			{/if}
			<!-- Show line if insering -->
			{#if effectiveHighlight === InsertionType.insertBelow}
				<div class="insert-line-wrapper">
					<div class="insert-line {classes.inserLineClass}" />
				</div>
			{/if}
		</li>
	{/each}
</ul>
